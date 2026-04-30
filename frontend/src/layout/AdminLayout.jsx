import Sidebar from './Sidebar';
import Topbar from './Topbar';
import ContentArea from './ContentArea';
import Banner from './Banner';

export default function AdminLayout({
  title,
  subtitle,
  topbarActions,
  menuItems,
  selectedPage,
  onSelectPage,
  isOperating,
  operatingMessage,
  banner,
  disabledMenuItems,
  elapsedTime,
  currentAction,
  children,
}) {
  return (
    <div className="app-shell">
      <Sidebar menuItems={menuItems} selectedPage={selectedPage} onSelectPage={onSelectPage} disabledMenuItems={disabledMenuItems} />

      <div className="main-pane">
        <Topbar title={title} subtitle={subtitle} actions={topbarActions} isOperating={isOperating} operatingMessage={operatingMessage} elapsedTime={elapsedTime} currentAction={currentAction} />
        <ContentArea>{children}</ContentArea>
        <Banner banner={banner} />
      </div>
    </div>
  );
}
