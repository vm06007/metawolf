"use client";

import { Form, FormControl, FormField, FormItem, FormMessage, FormStateMessage } from "./ui/form";
import type { NewsletterSchema } from "@/lib/schema";
import { useForm, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newsletterSchema } from "@/lib/schema";
import { subscribe } from "@/lib/subscribe";
import { useEffect, useState } from "react";
import { ActionResult, cn } from "@/lib/utils";
import { AlertTitle, alertVariants } from "./ui/alert";
import { CheckCircledIcon, CrossCircledIcon } from "@radix-ui/react-icons";
import { motion } from "framer-motion";

const SPRING = {
  type: "spring" as const,
  stiffness: 130.40,
  damping: 14.50,
  mass: 1,
};

const SubmissionStateMessage = ({ value, reset }: { value: ActionResult<string> | null, reset: () => void }) => {
  const form = useFormContext<NewsletterSchema>();

  useEffect(() => {
    if (Object.keys(form.formState.errors).length > 0) {
      reset();
    }
  }, [form.formState.errors, reset]);
  
  return (
    <FormStateMessage>
      {value?.success === true && (
        <motion.div
          key={value.id}
          className={cn(
            alertVariants({ variant: "success" }),
            "absolute top-0 left-0 right-0 mx-auto w-max"
          )}
          exit={{ opacity: 0, y: 10, scale: 0.8 }}
          initial={{ opacity: 0, y: 10, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={SPRING}
        >
          <CheckCircledIcon />
          <AlertTitle>{value.data}</AlertTitle>
        </motion.div>
      )}
    </FormStateMessage>
  )
}

const getDefaultValues = () => {
  if (typeof window !== 'undefined') {
    const email = localStorage.getItem('email');
    return { email: email || '' };
  }

  return { email: '' };
}

export const FormNewsletter = ({
  input,
  submit,
}: {
  input: (props: React.ComponentProps<"input">) => React.ReactNode;
  submit: (props: React.ComponentProps<"button">) => React.ReactNode;
}) => {
  const [submissionState, setSubmissionState] =
    useState<ActionResult<string> | null>(null);

  const form = useForm<NewsletterSchema>({
    resolver: zodResolver(newsletterSchema),
    defaultValues: getDefaultValues()
  });

  useEffect(() => {
    return () => {
      const v = form.getValues('email');

      if (v != undefined) {
        localStorage.setItem('email', v);
      }
    }
  }, [form]);

  async function onSubmit(values: NewsletterSchema) {
    const state = await subscribe(values.email);

    setSubmissionState(state);

    if (state.success === true) {
      form.reset({ email: '' });
    }

    if (state.success === false) {
      form.setError("email", { message: state.message });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="relative pt-10 lg:pt-12">
        <SubmissionStateMessage value={submissionState} reset={() => setSubmissionState(null)} />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormMessage>
                {(error) => (
                  <motion.div
                    key={error}
                    className={cn(
                      alertVariants({ variant: "destructive" }),
                      "absolute top-0 left-0 right-0 mx-auto w-max"
                    )}
                    initial={{ opacity: 0, y: 10, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.8 }}
                    transition={SPRING}
                  >
                    <CrossCircledIcon />
                    <AlertTitle>{error}</AlertTitle>
                  </motion.div>
                )}
              </FormMessage>
              <FormControl>
                <div className="relative">
                  {input({ ...field })}
                  <div className="absolute right-0 top-1/2 -translate-y-1/2">
                    {submit({
                      type: "submit",
                      disabled: form.formState.isSubmitting,
                    })}
                  </div>
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
