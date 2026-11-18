// Keeps the wrong people from a page they could not use:
//   nobody signed in         -> the sign in page, which brings them back here afterwards
//   another type of account  -> what is given as `denied` (a short message)
//   the right account type   -> the page
// The server checks the account type again for everything that matters, so this only decides what the pages show.
import type { ReactNode } from "react";
import { useAuth } from "../AuthContext";
import type { AccountType } from "./AuthShell";
import RequireAuth from "./RequireAuth";

interface RequireAccountTypeProps {
  accountType: AccountType;
  denied: ReactNode;
  children: ReactNode;
}

function OfType({ accountType, denied, children }: RequireAccountTypeProps) {
  const { user } = useAuth();
  return <>{user?.accountType === accountType ? children : denied}</>;
}

export default function RequireAccountType(props: RequireAccountTypeProps) {
  return (
    <RequireAuth>
      <OfType {...props} />
    </RequireAuth>
  );
}
