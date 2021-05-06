export const NumberField = ({ value, onChange, step, max, min }) => {
  return (
    <input
      type="number"
      className="p-2 mr-2 rounded shadow-inner shadow-md border w-full"
      step={step}
      max={max}
      min={min}
      value={value}
      onChange={onChange}
    />
  );
};
