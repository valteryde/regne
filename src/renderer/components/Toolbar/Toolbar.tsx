import React from 'react';
import { Ribbon, RibbonProps } from '../Ribbon/Ribbon';

export type { RibbonProps as ToolbarProps };

export const Toolbar: React.FC<RibbonProps> = (props) => {
  return <Ribbon {...props} />;
};

export default Toolbar;
