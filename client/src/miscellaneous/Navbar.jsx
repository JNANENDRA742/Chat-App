import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaBell, FaUserCircle, FaCommentDots, FaCog, FaSignOutAlt, FaUserFriends } from 'react-icons/fa';
import ProfileModal from '../pages/ProfileModal';
import LogoutModal from '../components/LogoutModel'; // Import the logout modal

const Navbar = ({ totalUnread = 0}) => {
  const [value, setValue] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [user, setUser] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await axios.get(
          "http://10.48.202.230:5000/api/user/profile",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        console.log(response.data);
        setUser(response.data);
      } catch (error) {
        console.error(error);
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [token, navigate]);

  const handleSignOutClick = () => {
    setIsProfileOpen(false);
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = () => {
    setIsLoggingOut(true);

    // Simulate a small delay for better UX
    setTimeout(() => {
      localStorage.removeItem("token");
      setIsLoggingOut(false);
      setIsLogoutModalOpen(false);
      navigate("/");
    }, 500);
  };

  const handleProfileClick = () => {
    setIsProfileOpen(false);
    setIsProfileModalOpen(true);
  };

  const handleProfileUpdate = (updatedUser) => {
    setUser(updatedUser);
  };


  return (
    <>
      <nav className="w-full bg-white shadow-lg border-b border-gray-200 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">

            {/* Logo and Brand */}
            <div
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => navigate("/chats")}
            >
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-xl">
                <FaCommentDots className="text-white text-xl" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xl bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  ChatHub
                </span>
                <span className="text-xs text-gray-500 hidden sm:block">
                  Connect instantly
                </span>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 transition-colors duration-200"
              >
                <div className="relative">
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-r from-blue-500 to-purple-600">
                    {user?.profilePicture ? (
                      <img
                        src={user.profilePicture}
                        alt="Profile"
                        className="w-full h-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FaUserCircle className="text-white text-2xl" />
                      </div>
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                </div>
                <span className="hidden sm:block text-gray-700 font-medium">
                  {isLoading ? "Loading..." : user?.name || "User"}
                </span>
              </button>

              {/* Dropdown Menu */}
              {isProfileOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileOpen(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg py-1 z-50 border border-gray-200">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="text-sm font-medium text-gray-900">{user?.name || "User"}</p>
                      <p className="text-xs text-gray-500">{user?.email || "user@example.com"}</p>
                    </div>
                    <button
                      onClick={handleProfileClick}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3 transition-colors duration-200"
                    >
                      <FaUserCircle className="text-gray-500" />
                      <span>Profile</span>
                    </button>

                    <hr className="my-1 border-gray-200" />
                    <button
                      onClick={handleSignOutClick}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center space-x-3 transition-colors duration-200"
                    >
                      <FaSignOutAlt className="text-red-500" />
                      <span>Sign out</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Right Section */}
            {/* <div className='p-4 rounded-lg'>
              <button
                onClick={handleSignOutClick}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-200 flex items-center space-x-3 transition-colors duration-200 rounded-lg"
              >
                <FaSignOutAlt className="text-red-500" />
                <span>LogOut</span>
              </button>
            </div> */}
            <div className="relative">
        <FaBell className="text-2xl text-gray-600 cursor-pointer hover:text-blue-500 transition-colors" />
        
        {/* ✅ Notification Badge */}
        {totalUnread > 0 && (
          <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center animate-pulse">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </div>
          </div>


        </div>
      </nav>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={user}
        onUpdate={handleProfileUpdate}
      />

      {/* Logout Modal */}
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleConfirmLogout}
        isLoading={isLoggingOut}
      />
    </>
  );
};

export default Navbar;