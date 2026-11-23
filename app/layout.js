
import "./globals.css";

export const metadata = {
  title: "My Calendar",
  description: "나만의 일정 관리 캘린더",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
