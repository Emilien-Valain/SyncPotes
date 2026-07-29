import "react";

// The design relies on `text-wrap: pretty` and a `--cellh` custom property in
// inline styles. Depending on the resolved csstype version these may not be in
// React.CSSProperties yet, so we declare them explicitly to keep the port
// compiling.
declare module "react" {
  interface CSSProperties {
    textWrap?: "wrap" | "nowrap" | "balance" | "pretty" | "stable";
    "--cellh"?: string;
  }
}
