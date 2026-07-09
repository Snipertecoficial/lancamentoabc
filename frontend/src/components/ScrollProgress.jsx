import React, { useEffect, useState } from "react";

const ScrollProgress = () => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const update = () => {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = (document.documentElement.scrollHeight || document.body.scrollHeight) - document.documentElement.clientHeight;
      setW(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);
  return <div className="scroll-progress" style={{ width: `${w}%` }} data-testid="scroll-progress" />;
};

export default ScrollProgress;
