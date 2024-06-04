export const Select = ({ value, onChange, children }) => {
  return (
    <select
      className="shadow-inner shadow-md mr-2 p-2 border rounded w-full"
      value={value}
      onChange={onChange}
    >
      {children}
    </select>
  );
};
