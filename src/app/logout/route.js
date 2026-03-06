<button
  className="link"
  onClick={async () => {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    setProfileMenu(false);
    window.location.href = "/";
  }}
>
  <div className="leftSide">
    <span className="icon">⎋</span>
    <span className="name">Log out</span>
  </div>
  <span className="actionIcon">
    <FaAngleRight />
  </span>
</button>