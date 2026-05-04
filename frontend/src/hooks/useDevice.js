import { useState, useEffect } from 'react';

export const useDevice = () => {
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;
      const isMobileDevice = mobileRegex.test(userAgent.toLowerCase());
      const isSmallScreen = window.innerWidth < 768;
      
      setIsMobile(isMobileDevice || isSmallScreen);
      setIsDesktop(!isMobileDevice && window.innerWidth >= 768);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return { isMobile, isDesktop };
};

export const checkDeviceRestriction = (feature) => {
  const restrictions = {
    venta: { allowed: ['desktop'], message: 'Las ventas solo pueden realizarse desde PC' },
    cierreCaja: { allowed: ['desktop'], message: 'El cierre de caja solo puede realizarse desde PC' },
    aperturaCaja: { allowed: ['desktop'], message: 'La apertura de caja solo puede realizarse desde PC' },
    reportes: { allowed: ['desktop'], message: 'Los reportes solo pueden verse desde PC' },
    gestionarUsuarios: { allowed: ['desktop'], message: 'La gestión de usuarios solo puede realizarse desde PC' },
  };
  
  return restrictions[feature] || { allowed: ['desktop', 'mobile'], message: '' };
};