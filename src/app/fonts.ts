import localFont from 'next/font/local';

export const sarabun = localFont({
  src: [
    { path: '../fonts/Sarabun-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/Sarabun-Bold.ttf', weight: '700', style: 'normal' },
  ],
  variable: '--font-sarabun',
  display: 'block',
});
