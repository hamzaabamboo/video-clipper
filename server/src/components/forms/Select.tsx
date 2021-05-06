export const Select = ({ value, onChange, children }) => {
  return (
    <select
      className="p-2 mr-2 rounded border shadow-inner shadow-md w-full "
      value={value}
      onChange={onChange}
    >
      {children}
    </select>
  );
};
