import React, { ReactNode } from "react";

export type FCWithChildren<Props = {}> = React.FC<
  Props & {
    children?: ReactNode;
  }
>;
