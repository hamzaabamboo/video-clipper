import { useEffect, useRef } from "react";

export const MessageLog = ({ logs }: { logs: string[] }) => {
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!messageEndRef.current) return;
    messageEndRef.current.scrollIntoView({
      behavior: "smooth",
    });
  }, [logs]);

  return (
    <div
      className="flex flex-col break-all overflow-y-auto"
      style={{ height: "300px" }}
    >
      {logs.map((l, index) => {
        return <p key={index}>{l}</p>;
      })}
      <div ref={messageEndRef} className="w-full"></div>
    </div>
  );
};
