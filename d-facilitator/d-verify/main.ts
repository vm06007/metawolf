import { cre, type Runtime, type HTTPPayload, Runner,decodeJson } from "@chainlink/cre-sdk"
 import { verify, settle } from "x402/facilitator";
import {
  PaymentRequirementsSchema,
  type PaymentRequirements,
  type PaymentPayload,
  PaymentPayloadSchema,
  createConnectedClient,
  createSigner,
  SupportedEVMNetworks,
  SupportedSVMNetworks,
  Signer,
  ConnectedClient,
  SupportedPaymentKind,
  isSvmSignerWallet,
  type X402Config,
} from "x402/types";


type Config = {
  authorizedEVMAddress: string
}

type RequestData = {
  message: string
  value: number
}

const onHttpTrigger = (runtime: Runtime<Config>, payload: HTTPPayload): string => {
  // The payload.input is a Uint8Array.
  // You can decode it to a JSON object using the decodeJson helper.
  const requestData = decodeJson(payload.input)
  runtime.log(`Received HTTP request: ${JSON.stringify(requestData)}`) // data passed from the http call ?

  // Your logic here...
  // The value returned from your callback will be sent back as the HTTP response.
  return `Request processed: ${requestData.message}`
}


const initWorkflow = (config: Config) => {
  const httpTrigger = new cre.capabilities.HTTPCapability()

  return [
    cre.handler(
      httpTrigger.trigger({
        authorizedKeys: [
          {
            type: "KEY_TYPE_ECDSA_EVM",
            publicKey: config.authorizedEVMAddress,
          },
        ],
      }),
      onHttpTrigger
    ),
  ]
}

export async function main() {
  const runner = await Runner.newRunner<Config>()
  await runner.run(initWorkflow)
}

main()

