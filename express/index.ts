import { NextFunction, Request, Response } from "express";
import { Address, getAddress } from "viem";
import { exact } from "x402/schemes";
import {
  computeRoutePatterns,
  findMatchingPaymentRequirements,
  findMatchingRoute,
  processPriceToAtomicAmount,
  toJsonSafe,
} from "x402/shared";
import { getPaywallHtml } from "x402/paywall";
import {
  FacilitatorConfig,
  ERC20TokenAmount,
  moneySchema,
  PaymentPayload,
  PaymentRequirements,
  PaywallConfig,
  Resource,
  RoutesConfig,
  settleResponseHeader,
  SupportedEVMNetworks,
} from "x402/types";
import { useFacilitator } from "x402/verify";

/**
 * Subscription configuration for a route
 */
export interface SubscriptionConfig {
  price: string | number | { amount: string; asset: { address: Address; decimals: number } };
  network: (typeof SupportedEVMNetworks)[number];
  billingPeriod?: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  maxRequestsPerPeriod?: number;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  customPaywallHtml?: string;
  resource?: Resource;
  discoverable?: boolean;
}

/**
 * Routes configuration for subscriptions (EVM only)
 */
export type SubscriptionRoutesConfig = {
  [pattern: string]: SubscriptionConfig;
};

/**
 * Creates a subscription middleware factory for Express (EVM networks only)
 *
 * @param payTo - The address to receive subscription payments
 * @param routes - Configuration for protected routes and their subscription requirements
 * @param facilitator - Optional configuration for the payment facilitator service
 * @param paywall - Optional configuration for the default paywall
 * @returns An Express middleware handler
 *
 * @example
 * ```typescript
 * // Simple configuration - All endpoints require $10/month subscription on base-sepolia
 * app.use(subscriptionMiddleware(
 *   '0x123...', // payTo address
 *   {
 *     price: '$10', // USDC amount in dollars
 *     network: 'base-sepolia',
 *     billingPeriod: 'monthly'
 *   }
 * ));
 *
 * // Advanced configuration - Endpoint-specific subscription requirements
 * app.use(subscriptionMiddleware(
 *   '0x123...',
 *   {
 *     '/api/premium/*': {
 *       price: '$20',
 *       network: 'base',
 *       billingPeriod: 'monthly',
 *       maxRequestsPerPeriod: 1000
 *     },
 *     '/api/basic/*': {
 *       price: '$5',
 *       network: 'base-sepolia',
 *       billingPeriod: 'monthly',
 *       maxRequestsPerPeriod: 100
 *     }
 *   },
 *   {
 *     url: 'https://facilitator.example.com',
 *     createAuthHeaders: async () => ({
 *       verify: { "Authorization": "Bearer token" },
 *       settle: { "Authorization": "Bearer token" }
 *     })
 *   },
 *   {
 *     cdpClientKey: 'your-cdp-client-key',
 *     appLogo: '/images/logo.svg',
 *     appName: 'My App',
 *   }
 * ));
 * ```
 */
/**
 * Options for subscription middleware behavior
 */
export interface SubscriptionMiddlewareOptions {
  /** If true, only verify payment without settling */
  verifyOnly?: boolean;
  /** If true, only settle payment (assumes already verified) */
  settleOnly?: boolean;
  /** Skip verification entirely (for settle-only mode) */
  skipVerification?: boolean;
}

/**
 * Creates a subscription middleware factory for Express (EVM networks only)
 *
 * @param payTo - The address to receive subscription payments
 * @param routes - Configuration for protected routes and their subscription requirements
 * @param facilitator - Optional configuration for the payment facilitator service
 * @param paywall - Optional configuration for the default paywall
 * @param options - Optional middleware behavior options (verifyOnly, settleOnly, etc.)
 * @returns An Express middleware handler
 */
export function subscriptionMiddleware(
  payTo: Address,
  routes: SubscriptionRoutesConfig,
  facilitator?: FacilitatorConfig,
  paywall?: PaywallConfig,
  options?: SubscriptionMiddlewareOptions,
) {
  const { verify, settle, supported } = useFacilitator(facilitator);
  const x402Version = 1;
  const { verifyOnly = false, settleOnly = false, skipVerification = false } = options || {};

  // Pre-compile route patterns to regex and extract verbs
  const routePatterns = computeRoutePatterns(routes);

  return async function subscriptionMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const matchingRoute = findMatchingRoute(routePatterns, req.path, req.method.toUpperCase());

    if (!matchingRoute) {
      return next();
    }

    const { price, network, config = {} } = matchingRoute.config;
    const {
      description,
      mimeType,
      maxTimeoutSeconds,
      inputSchema,
      outputSchema,
      customPaywallHtml,
      resource,
      discoverable,
      billingPeriod = "monthly",
      maxRequestsPerPeriod,
    } = config;

    // Validate network is EVM
    if (!SupportedEVMNetworks.includes(network)) {
      res.status(400).json({
        x402Version,
        error: `Unsupported network: ${network}. Only EVM networks are supported for subscriptions.`,
        supportedNetworks: SupportedEVMNetworks,
      });
      return;
    }

    const atomicAmountForAsset = processPriceToAtomicAmount(price, network);
    if ("error" in atomicAmountForAsset) {
      throw new Error(atomicAmountForAsset.error);
    }
    const { maxAmountRequired, asset } = atomicAmountForAsset;

    const resourceUrl: Resource =
      resource || (`${req.protocol}://${req.headers.host}${req.path}` as Resource);

    const paymentRequirements: PaymentRequirements[] = [
      {
        scheme: "exact",
        network,
        maxAmountRequired,
        resource: resourceUrl,
        description: description ?? `Subscription: ${billingPeriod}`,
        mimeType: mimeType ?? "",
        payTo: getAddress(payTo),
        maxTimeoutSeconds: maxTimeoutSeconds ?? 60,
        asset: getAddress(asset.address),
        outputSchema: {
          input: {
            type: "http",
            method: req.method.toUpperCase(),
            discoverable: discoverable ?? true,
            ...inputSchema,
          },
          output: outputSchema,
        },
        extra: {
          ...(asset as ERC20TokenAmount["asset"]).eip712,
          billingPeriod,
          maxRequestsPerPeriod,
        },
      },
    ];

    const payment = req.header("X-PAYMENT");
    const userAgent = req.header("User-Agent") || "";
    const acceptHeader = req.header("Accept") || "";
    const isWebBrowser = acceptHeader.includes("text/html") && userAgent.includes("Mozilla");

    if (!payment) {
      if (isWebBrowser) {
        let displayAmount: number;
        if (typeof price === "string" || typeof price === "number") {
          const parsed = moneySchema.safeParse(price);
          if (parsed.success) {
            displayAmount = parsed.data;
          } else {
            displayAmount = Number.NaN;
          }
        } else {
          displayAmount = Number(price.amount) / 10 ** price.asset.decimals;
        }

        const html =
          customPaywallHtml ||
          getPaywallHtml({
            amount: displayAmount,
            paymentRequirements: toJsonSafe(paymentRequirements) as Parameters<
              typeof getPaywallHtml
            >[0]["paymentRequirements"],
            currentUrl: req.originalUrl,
            testnet: network === "base-sepolia",
            cdpClientKey: paywall?.cdpClientKey,
            appName: paywall?.appName,
            appLogo: paywall?.appLogo,
            sessionTokenEndpoint: paywall?.sessionTokenEndpoint,
          });
        res.status(402).send(html);
        return;
      }
      res.status(402).json({
        x402Version,
        error: "X-PAYMENT header is required for subscription access",
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    let decodedPayment: PaymentPayload;
    try {
      decodedPayment = exact.evm.decodePayment(payment);
      decodedPayment.x402Version = x402Version;
    } catch (error) {
      console.error(error);
      res.status(402).json({
        x402Version,
        error: error || "Invalid or malformed payment header",
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    const selectedPaymentRequirements = findMatchingPaymentRequirements(
      paymentRequirements,
      decodedPayment,
    );
    if (!selectedPaymentRequirements) {
      res.status(402).json({
        x402Version,
        error: "Unable to find matching payment requirements",
        accepts: toJsonSafe(paymentRequirements),
      });
      return;
    }

    // Verify payment (unless in settle-only mode with skipVerification)
    if (!settleOnly || !skipVerification) {
      try {
        const response = await verify(decodedPayment, selectedPaymentRequirements);
        if (!response.isValid) {
          res.status(402).json({
            x402Version,
            error: response.invalidReason,
            accepts: toJsonSafe(paymentRequirements),
            payer: response.payer,
          });
          return;
        }
      } catch (error) {
        console.error(error);
        res.status(402).json({
          x402Version,
          error,
          accepts: toJsonSafe(paymentRequirements),
        });
        return;
      }
    }

    // If verify-only mode, return success after verification
    if (verifyOnly) {
      res.status(200).json({
        x402Version,
        verified: true,
        payer: decodedPayment.payload.authorization?.from,
        message: "Payment verified successfully",
      });
      return;
    }

    // If verify-only mode, return success after verification (no buffering needed)
    if (verifyOnly) {
      res.status(200).json({
        x402Version,
        verified: true,
        payer: decodedPayment.payload.authorization?.from,
        message: "Payment verified successfully",
      });
      return;
    }

    // Intercept and buffer all core methods that can commit response to client
    // (Only needed for settle-only or normal verify+settle modes)
    const originalWriteHead = res.writeHead.bind(res);
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const originalFlushHeaders = res.flushHeaders.bind(res);

    type BufferedCall =
      | ["writeHead", Parameters<typeof originalWriteHead>]
      | ["write", Parameters<typeof originalWrite>]
      | ["end", Parameters<typeof originalEnd>]
      | ["flushHeaders", []];

    let bufferedCalls: BufferedCall[] = [];
    let settled = false;

    res.writeHead = function (...args: Parameters<typeof originalWriteHead>) {
      if (!settled) {
        bufferedCalls.push(["writeHead", args]);
        return res;
      }
      return originalWriteHead(...args);
    } as typeof originalWriteHead;

    res.write = function (...args: Parameters<typeof originalWrite>) {
      if (!settled) {
        bufferedCalls.push(["write", args]);
        return true;
      }
      return originalWrite(...args);
    } as typeof originalWrite;

    res.end = function (...args: Parameters<typeof originalEnd>) {
      if (!settled) {
        bufferedCalls.push(["end", args]);
        return res;
      }
      return originalEnd(...args);
    } as typeof originalEnd;

    res.flushHeaders = function () {
      if (!settled) {
        bufferedCalls.push(["flushHeaders", []]);
        return;
      }
      return originalFlushHeaders();
    };

    // If settle-only mode, skip route handler and go straight to settlement
    if (settleOnly) {
      // Settlement will happen below, skip next()
    } else {
      // Proceed to the next middleware or route handler
      await next();
    }

    // If the response from the protected route is >= 400, do not settle subscription usage
    if (!settleOnly && res.statusCode >= 400) {
      settled = true; // stop intercepting calls
      res.writeHead = originalWriteHead;
      res.write = originalWrite;
      res.end = originalEnd;
      res.flushHeaders = originalFlushHeaders;

      // Replay all buffered calls in order
      for (const [method, args] of bufferedCalls) {
        if (method === "writeHead")
          originalWriteHead(...(args as Parameters<typeof originalWriteHead>));
        else if (method === "write") originalWrite(...(args as Parameters<typeof originalWrite>));
        else if (method === "end") originalEnd(...(args as Parameters<typeof originalEnd>));
        else if (method === "flushHeaders") originalFlushHeaders();
      }
      bufferedCalls = [];
      return;
    }

    // Settle payment
    try {
      const settleResponse = await settle(decodedPayment, selectedPaymentRequirements);
      const responseHeader = settleResponseHeader(settleResponse);
      res.setHeader("X-PAYMENT-RESPONSE", responseHeader);

      // if the settle fails, return an error
      if (!settleResponse.success) {
        bufferedCalls = [];
        res.status(402).json({
          x402Version,
          error: settleResponse.errorReason,
          accepts: toJsonSafe(paymentRequirements),
        });
        return;
      }

      // If settle-only mode, return settlement result
      if (settleOnly) {
        bufferedCalls = [];
        res.status(200).json({
          x402Version,
          settled: true,
          transaction: settleResponse.transaction,
          network: settleResponse.network,
          payer: decodedPayment.payload.authorization?.from,
        });
        return;
      }
    } catch (error) {
      console.error(error);
      // If settlement fails and the response hasn't been sent yet, return an error
      if (!res.headersSent) {
        bufferedCalls = [];
        res.status(402).json({
          x402Version,
          error,
          accepts: toJsonSafe(paymentRequirements),
        });
        return;
      }
    } finally {
      settled = true;
      res.writeHead = originalWriteHead;
      res.write = originalWrite;
      res.end = originalEnd;
      res.flushHeaders = originalFlushHeaders;

      // Replay all buffered calls in order
      for (const [method, args] of bufferedCalls) {
        if (method === "writeHead")
          originalWriteHead(...(args as Parameters<typeof originalWriteHead>));
        else if (method === "write") originalWrite(...(args as Parameters<typeof originalWrite>));
        else if (method === "end") originalEnd(...(args as Parameters<typeof originalEnd>));
        else if (method === "flushHeaders") originalFlushHeaders();
      }
      bufferedCalls = [];
    }
  };
}

// Re-export types for convenience
export type {
  Money,
  Network,
  Resource,
} from "x402/types";

