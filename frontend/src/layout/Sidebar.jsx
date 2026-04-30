export default function Sidebar({ menuItems, selectedPage, onSelectPage, disabledMenuItems = [] }) {
  return (
    <aside className="sidebar">
      <div className="brand">MMI Admin</div>

      <nav className="nav-links" aria-label="Main menu">
        {menuItems.map((item) => {
          const isDisabled = disabledMenuItems?.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${selectedPage === item.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
              onClick={() => !isDisabled && onSelectPage(item.id)}
              disabled={isDisabled}
              title={isDisabled ? `${item.label} is only available when period is Active` : ''}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
