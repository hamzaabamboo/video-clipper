export const NumberField = ({ value, onChange, step, max, min }) => {
  return (
    <input
      type="number"
      className="shadow-inner shadow-md mr-2 p-2 border rounded w-full"
      step={step}
      max={max}
      min={min}
      value={value}
      onChange={onChange}
    />
  );
};
