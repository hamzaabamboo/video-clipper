export const Section: React.FC<{ main?: boolean; sub?: boolean }> = ({
  children,
  main,
  sub,
}) => {
  return main ? (
    <div className="p-4 mb-2 rounded-md shadow-md bg-gray-100">{children}</div>
  ) : (
    <div className="p-4 mb-2 rounded-md border-2 bg-gray-100">{children}</div>
  );
};
