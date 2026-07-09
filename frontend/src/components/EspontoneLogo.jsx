import React from "react";

const EspontoneLogo = ({ className = "" }) => {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <span 
        className="relative flex items-center justify-center bg-white rounded-xl overflow-hidden" 
        style={{ 
          height: 54, 
          padding: "4px 10px",
          boxShadow: "0 4px 15px rgba(0,0,0,0.25), 0 0 20px rgba(91,149,206,0.15)"
        }}
      >
        <img
          src="/logo-ofc.png"
          alt="Espontone Imóveis"
          className="h-full w-auto object-contain"
          loading="eager"
        />
      </span>
    </span>
  );
};

export default EspontoneLogo;
