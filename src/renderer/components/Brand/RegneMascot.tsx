import React from 'react';
import logoUrl from '../../assets/logo.png';

export interface RegneMascotProps {
  size?: number;
  isEvaluating?: boolean;
  className?: string;
}

export const RegneMascot: React.FC<RegneMascotProps> = ({
  size = 24,
  isEvaluating = false,
  className = '',
}) => {
  return (
    <div
      className={`relative inline-flex items-center justify-center select-none cursor-default shrink-0 overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      title={isEvaluating ? 'Regne (Computing...)' : 'Regne'}
    >
      <img
        src={logoUrl}
        alt="Regne Logo"
        className="w-full h-full object-cover block select-none pointer-events-none"
        style={{
          width: size,
          height: size,
        }}
      />
      {isEvaluating && (
        <span
          className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-amber-400 animate-pulse"
          title="Computing..."
        />
      )}
    </div>
  );
};

export const RegneLogo = RegneMascot;
export const HypatiaMascot = RegneMascot;
export type HypatiaMascotProps = RegneMascotProps;
