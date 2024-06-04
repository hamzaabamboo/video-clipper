import { FCWithChildren } from "src/types/FCWithChildren";

export const Section: FCWithChildren<{ main?: boolean; sub?: boolean }> = ({
  children,
  main,
  sub,
}) => {
  return main ? (
    <div className="bg-gray-100 shadow-md mb-2 p-4 rounded-md">{children}</div>
  ) : (
    <div className="border-2 bg-gray-100 mb-2 p-4 rounded-md">{children}</div>
  );
};
