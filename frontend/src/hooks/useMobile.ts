import { useState, useEffect } from 'react';

interface MobileInfo {
  isMobile: boolean;
  isTablet: boolean;
  isTouch: boolean;
  isLandscape: boolean;
  screenWidth: number;
  screenHeight: number;
}

export function useMobile(): MobileInfo {
  const [mobileInfo, setMobileInfo] = useState<MobileInfo>(() => {
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isTouch: false,
        isLandscape: false,
        screenWidth: 1920,
        screenHeight: 1080
      };
    }
    
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isLandscape: width > height,
      screenWidth: width,
      screenHeight: height
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setMobileInfo({
        isMobile: width < 768,
        isTablet: width >= 768 && width < 1024,
        isTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        isLandscape: width > height,
        screenWidth: width,
        screenHeight: height
      });
    };

    // Também detectar mudança de orientação
    const handleOrientationChange = () => {
      // Pequeno delay para garantir que as dimensões foram atualizadas
      setTimeout(handleResize, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  return mobileInfo;
}
