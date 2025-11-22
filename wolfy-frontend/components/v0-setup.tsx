"use client";

import { checkEnvs } from "@/lib/actions";
import { SetupToolbar } from "@joycostudio/v0-setup";

export const V0Setup = () => {
  return (
    <SetupToolbar
      title="V0 Newsletter Setup"
      description="Setup your V0 Newsletter"
      envCheckAction={checkEnvs}
    />
  );
};

export default V0Setup;
