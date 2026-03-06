"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";
import { MdSearch, MdClose } from "react-icons/md";
import { FaAngleRight } from "react-icons/fa";
import { FaAngleDown, FaFaceFrown } from "react-icons/fa6";
import { FaUserCircle, FaCompass } from "react-icons/fa";
import { DEMO_PLAYLISTS } from "@/lib/demoPlaylists";
import { motion } from "framer-motion";
import { useClickOutside } from "@mantine/hooks";
import { createBrowserClient } from "@/lib/supabase-browser";





const Navbar = () => {
  const [isFocused, setIsFocused] = useState(false);
  const ref = useClickOutside(() => setIsFocused(false));
  const [searchValue, setSearchValue] = useState("");
  const [ProfileMenu, setProfileMenu] = useState(false);
  const [searchedPlaylists, setSearchedPlaylists] = useState([]);
  const [searchPanel, setSearchPanel] = useState(false);

  const pathname = usePathname();
  const router = useRouter();

  // Supabase auth (real user)
  const [isAuthed, setIsAuthed] = useState(false);
  const [currentUser, setCurrentUser] = useState({
    name: "Guest",
    handle: "guest",
    profilePic: "/assets/image/avatar_default.jpg",
  });

  const supabaseRef = useRef(null);
  const profileRef = useRef(null);

  useEffect(() => {
    let supabase;
    try {
      supabase = createBrowserClient();
      supabaseRef.current = supabase;
    } catch (e) {
      // Env vars missing or misconfigured; keep navbar usable as Guest
      supabaseRef.current = null;
      setIsAuthed(false);
      setCurrentUser({
        name: "Guest",
        handle: "guest",
        profilePic: "/assets/image/avatar_default.jpg",
      });
      return;
    }

    const toHandle = (email) => {
      if (!email) return "guest";
      const base = email.split("@")[0] || "guest";
      return base.toLowerCase();
    };

    const applyUser = (user) => {
      if (!user) {
        setIsAuthed(false);
        setCurrentUser({
          name: "Guest",
          handle: "guest",
          profilePic: "/assets/image/avatar_default.jpg",
        });
        return;
      }

      const email = user.email || "";
      const handle = toHandle(email);
      const meta = user.user_metadata || {};
      const displayName = (meta.full_name || meta.name || handle || "User").toString();
      const avatar = (meta.avatar_url || meta.picture || "/assets/image/avatar_default.jpg").toString();

      setIsAuthed(true);
      setCurrentUser({
        name: displayName,
        handle,
        profilePic: avatar,
      });
    };

    // Initial session
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        applyUser(null);
        return;
      }
      applyUser(data?.session?.user ?? null);
    });

    // Live updates
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user ?? null);
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const searchPlaylists = (value) => {
    const v = (value || "").trim().toLowerCase();
    if (!v) {
      setSearchedPlaylists([]);
      return;
    }

    const results = DEMO_PLAYLISTS
      .filter((p) => p.isPublic)
      .filter((p) => {
        const hay = `${p.title} ${p.description ?? ""} ${p.handle} ${(p.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(v);
      })
      .slice(0, 8);

    setSearchedPlaylists(results);
  };

  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (!ProfileMenu) return;
      const el = profileRef.current;
      if (el && !el.contains(e.target)) {
        setProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [ProfileMenu]);

  return (
    <>
      <div className="inNavbar" style={{ position: "sticky", top: 0, zIndex: 1000000 }}>
        <Link href="/" className="inLogo">
          The Queue
        </Link>
        <div
          ref={ref}
          className={`inSearch ${isFocused ? "inSearchFocused" : ""}`}
        >
          <div className="inSearchWrapper">
            <div className="inSearchIcon">
              <MdSearch className="inIcon" />
            </div>
            <input
              type="text"
              onClick={() => setIsFocused(true)}
              placeholder="Search"
              value={searchValue}
              onFocus={() => setIsFocused(true)}
              onChange={(e) => {
                const v = e.target.value;
                setSearchValue(v);
                searchPlaylists(v);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const q = (searchValue || "").trim();
                  if (q) {
                    setIsFocused(false);
                    router.push(`/explore?q=${encodeURIComponent(q)}`);
                  }
                }
              }}
            />
            <div
              className={`inSearchCloseBtn ${
                searchValue.length >= 1 ? "inSearchCloseBtnActive" : ""
              }`}
            >
              <MdClose
                className="inIcon"
                onClick={() => {
                  setSearchValue("");
                  setIsFocused(false);
                  setSearchedPlaylists([]);
                }}
              />
            </div>
          </div>

          <motion.div
            className="searchResult"
            initial={{ y: 30, opacity: 0, pointerEvents: "none" }}
            animate={{
              y: isFocused ? 0 : 30,
              opacity: isFocused ? 1 : 0,
              pointerEvents: isFocused ? "auto" : "none",
            }}
          >
            {isFocused && (
              searchedPlaylists.length ? (
                searchedPlaylists.map((p) => (
                  <div
                    key={p.id}
                    className="searchResultItem"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setIsFocused(false);
                      setSearchValue("");
                      setSearchedPlaylists([]);
                      router.push(`/p/${p.id}`);
                    }}
                  >
                    <div className="userImage">
                      <img src={p.coverUrl || "/assets/image/avatar_default.jpg"} alt="" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <h3 style={{ margin: 0 }}>{p.title}</h3>
                      <span style={{ fontSize: 12, opacity: 0.9, color: "#111" }}>by @{p.handle}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="noUserFound">
                  <FaFaceFrown />
                  <h3>No playlists found</h3>
                </div>
              )
            )}
          </motion.div>
        </div>
        <div className="inNavRightOptions">
          <div className="mobileSearchBtn" onClick={() => setSearchPanel(true)}>
            <MdSearch />
          </div>
          {isAuthed ? (
            <Link className="inBtn" href="/new">
              Create Playlist
            </Link>
          ) : (
            <Link className="inBtn" href={`/login?next=${encodeURIComponent(pathname || "/")}`}>
              Sign in
            </Link>
          )}
          <div className="userProfile" ref={profileRef}>
            <div
              className="userImage"
              onClick={(e) => {
                e.stopPropagation();
                if (!isAuthed) {
                  window.location.href = `/login?next=${encodeURIComponent(pathname || "/")}`;
                  return;
                }
                setProfileMenu((v) => !v);
              }}
            >
              <img src={currentUser.profilePic} alt="User Profile Pic" />
            </div>
            <motion.div
              className="userProfileDropdown"
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                position: "fixed",
                top: 64,
                right: 16,
                zIndex: 1000001,
                pointerEvents: ProfileMenu ? "auto" : "none",
                color: "#111",
              }}
              initial={{ y: 10, opacity: 0 }}
              animate={{
                y: ProfileMenu ? 0 : 10,
                opacity: ProfileMenu ? 1 : 0,
              }}
              transition={{ duration: 0.18 }}
            >
              {isAuthed ? (
                <>
                  <Link
                    href={`/u/${currentUser.handle}`}
                    className="profileWrapper"
                    onClick={() => setProfileMenu(false)}
                  >
                    <img src={currentUser.profilePic} alt="User Profile Pic" />
                    <div className="profileData">
                      <div className="name" style={{ color: "#111" }}>{currentUser.name}</div>
                      <span className="seeProfile">See Profile</span>
                    </div>
                  </Link>
                  <div className="linksWrapper">
                    <Link
                      href={`/u/${currentUser.handle}?tab=settings`}
                      className="link"
                      onClick={() => setProfileMenu(false)}
                    >
                      <div className="leftSide">
                        <span className="icon">
                          <FaUserCircle />
                        </span>
                        <span className="name" style={{ color: "#111" }}>Profile</span>
                      </div>
                      <span className="actionIcon">
                        <FaAngleRight />
                      </span>
                    </Link>
                    <Link
                      href={`/explore?help=1`}
                      className="link"
                      onClick={() => setProfileMenu(false)}
                    >
                      <div className="leftSide">
                        <span className="icon">
                          <FaCompass />
                        </span>
                        <span className="name" style={{ color: "#111" }}>Explore</span>
                      </div>
                      <span className="actionIcon">
                        <FaAngleRight />
                      </span>
                    </Link>
                    <Link
                      href="#"
                      className="link"
                      onClick={async (e) => {
                        e.preventDefault();
                        setProfileMenu(false);
                        try {
                          await supabaseRef.current?.auth?.signOut?.();
                        } catch {}
                        // after sign out, return to home
                        window.location.href = "/";
                      }}
                    >
                      <div className="leftSide">
                        <span className="icon">⎋</span>
                        <span className="name" style={{ color: "#111" }}>Log out</span>
                      </div>
                      <span className="actionIcon">
                        <FaAngleRight />
                      </span>
                    </Link>
                  </div>
                </>
              ) : (
                <div className="linksWrapper">
                  <Link
                    href={`/login?next=${encodeURIComponent(pathname || "/")}`}
                    className="link"
                    onClick={() => setProfileMenu(false)}
                  >
                    <div className="leftSide">
                      <span className="icon">★</span>
                      <span className="name">Sign in</span>
                    </div>
                    <span className="actionIcon">
                      <FaAngleRight />
                    </span>
                  </Link>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        className="mobileSearchPanel"
        initial={{ y: "100vh", pointerEvents: "none", display: "none" }}
        animate={{
          display: searchPanel ? "block" : "none",
          y: searchPanel ? 0 : "100vh",
          pointerEvents: searchPanel ? "auto" : "none",
          transition: {
            bounce: 0.23,
            type: "spring",
          },
        }}
      >
        <div className="closeBtn" onClick={() => setSearchPanel(false)}>
          <FaAngleDown />
        </div>

        <div className="inMobileSearch">
          <div className="mobileSearchIcon">
            <MdSearch className="inIcon" />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchValue}
            onChange={(e) => {
              const v = e.target.value;
              setSearchValue(v);
              searchPlaylists(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const q = (searchValue || "").trim();
                if (q) {
                  setSearchPanel(false);
                  router.push(`/explore?q=${encodeURIComponent(q)}`);
                }
              }
            }}
          />
          {searchValue.length >= 1 && (
            <MdClose
              className="inIcon cursor-pointer"
              onClick={() => {
                setSearchValue("");
                setSearchedPlaylists([]);
              }}
            />
          )}
        </div>

        <div className="mobileSearchResult">
          {searchedPlaylists.length ? (
            searchedPlaylists.map((p) => (
              <div
                className="mobileSearchItem"
                key={p.id}
                onClick={() => {
                  setSearchValue("");
                  setSearchPanel(false);
                  setSearchedPlaylists([]);
                  router.push(`/p/${p.id}`);
                }}
              >
                <div className="profileImage">
                  <img src={p.coverUrl || "/assets/image/avatar_default.jpg"} alt="" />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <h3 style={{ margin: 0 }}>{p.title}</h3>
                  <span style={{ fontSize: 12, opacity: 0.9, color: "#111" }}>by @{p.handle}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="noUserFound">
              <FaFaceFrown />
              <h3>No playlists found</h3>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
};

export default Navbar;
