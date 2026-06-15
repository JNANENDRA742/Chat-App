import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { FaUserCircle, FaComments, FaUserPlus, FaSearch, FaArrowLeft, FaTimes, FaPlus, FaUser, FaCheck, FaSpinner, FaUsers } from "react-icons/fa";
import io from "socket.io-client";

const Chats = ({ selectedChat, onChatSelect, token: propToken, onNotificationUpdate }) => {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingGroupLoading, setCreatingGroupLoading] = useState(false);
  const [groupSearchTerm, setGroupSearchTerm] = useState("");
  const [groupSearchResults, setGroupSearchResults] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [socket, setSocket] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const token = propToken || localStorage.getItem("token");
  const navigate = useNavigate();

  const getCurrentUserId = () => {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return decoded.id;
    } catch (error) {
      return null;
    }
  };

  const currentUserId = getCurrentUserId();

  const getChatName = (chat) => {
    if (chat.isGroupChat) {
      return chat.chatName;
    } else {
      const otherUser = chat.users.find(user => user._id !== currentUserId);
      return otherUser?.name || "Unknown User";
    }
  };

  const getChatAvatar = (chat) => {
    if (!chat.isGroupChat) {
      const otherUser = chat.users.find(user => user._id !== currentUserId);
      return otherUser?.profilePicture || null;
    }
    return null;
  };

  const getLastMessageTime = (chat) => {
    if (chat.latestMessage) {
      return new Date(chat.latestMessage.createdAt).toLocaleTimeString(
        "en-IN",
        {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }
      );
    }
    return "No messages yet";
  };

  const handleChatSelect = async (chat) => {
    try {
      await axios.put(
        "https://chat-app-backend-xpug.onrender.com/api/chat/reset-unread",
        { chatId: chat._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setUnreadCounts(prev => ({ ...prev, [chat._id]: 0 }));
      
      if (onNotificationUpdate) {
        onNotificationUpdate();
      }
    } catch (error) {
      console.error("Error resetting unread count:", error);
    }
    
    onChatSelect(chat);
  };

  const searchUsers = async (query, isForGroup = false) => {
    if (!query.trim()) {
      if (isForGroup) {
        setGroupSearchResults([]);
      } else {
        setUsers([]);
      }
      return;
    }

    try {
      const response = await axios.get(
        `https://chat-app-backend-xpug.onrender.com/api/user?search=${query}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const filteredUsers = response.data.filter(
        user => user._id !== currentUserId && !groupMembers.some(member => member._id === user._id)
      );

      if (isForGroup) {
        setGroupSearchResults(filteredUsers);
      } else {
        setUsers(response.data.filter(user => user._id !== currentUserId));
      }
    } catch (error) {
      console.error("Error searching users:", error);
    }
  };

  const createNewChat = async (userId) => {
    try {
      const response = await axios.post(
        "https://chat-app-backend-xpug.onrender.com/api/chat",
        { userId },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setChats([response.data, ...chats]);
      setShowUserModal(false);
      setUsers([]);
      setSearchTerm("");
      onChatSelect(response.data);
    } catch (error) {
      console.error("Error creating chat:", error);
      alert(error.response?.data?.message || "Error creating chat");
    }
  };

  const addUserToGroup = (user) => {
    if (groupMembers.length >= 10) {
      alert("Maximum 10 members allowed in a group");
      return;
    }
    if (!groupMembers.some(member => member._id === user._id)) {
      setGroupMembers([...groupMembers, user]);
      setGroupSearchResults(groupSearchResults.filter(u => u._id !== user._id));
      setGroupSearchTerm("");
    }
  };

  const removeUserFromGroup = (userId) => {
    setGroupMembers(groupMembers.filter(user => user._id !== userId));
  };

  const createGroupChat = async () => {
    if (!groupName.trim()) {
      alert("Please enter a group name");
      return;
    }

    if (groupMembers.length < 2) {
      alert("Please add at least 2 members to create a group");
      return;
    }

    setCreatingGroupLoading(true);

    try {
      const userIds = groupMembers.map(member => member._id);

      const response = await axios.post(
        "https://chat-app-backend-xpug.onrender.com/api/chat/group",
        {
          name: groupName,
          users: userIds,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setChats([response.data, ...chats]);
      resetGroupCreation();
      onChatSelect(response.data);
    } catch (error) {
      console.error("Error creating group:", error);
      alert(error.response?.data?.message || "Error creating group chat");
    } finally {
      setCreatingGroupLoading(false);
    }
  };

  const resetGroupCreation = () => {
    setCreatingGroup(false);
    setGroupName("");
    setGroupMembers([]);
    setGroupSearchTerm("");
    setGroupSearchResults([]);
    setShowUserModal(false);
    setUsers([]);
    setSearchTerm("");
  };

  const handleCreateGroup = () => {
    setShowUserModal(true);
    setCreatingGroup(true);
    setGroupName("");
    setGroupMembers([]);
    setGroupSearchTerm("");
    setGroupSearchResults([]);
  };

  // Socket connection
  useEffect(() => {
    if (!token) return;

    const newSocket = io("https://chat-app-backend-xpug.onrender.com", {
      transports: ["websocket"],
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("Chats socket connected");
      setSocketConnected(true);
      
      if (currentUserId) {
        newSocket.emit("setup", currentUserId);
      }
    });

    newSocket.on("connected", () => {
      console.log("Socket setup complete");
    });

    newSocket.on("new notification", (data) => {
      console.log("New notification received in Chats:", data);
      
      setUnreadCounts(prev => ({
        ...prev,
        [data.chatId]: data.unreadCount
      }));
      
      if (onNotificationUpdate) {
        onNotificationUpdate();
      }
    });

    newSocket.on("chat update", ({ chatId, lastMessage }) => {
      console.log("Chat update received:", chatId, lastMessage);
      
      setChats(prevChats => {
        const updatedChats = prevChats.map(chat => {
          if (chat._id === chatId) {
            return { ...chat, latestMessage: lastMessage };
          }
          return chat;
        });
        return updatedChats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      });
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [token, currentUserId, onNotificationUpdate]);

  // Fetch chats
  useEffect(() => {
    const fetchChats = async () => {
      if (!token) {
        navigate("/");
        return;
      }

      try {
        const [chatsRes, unreadRes] = await Promise.all([
          axios.get("https://chat-app-backend-xpug.onrender.com/api/chat", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get("https://chat-app-backend-xpug.onrender.com/api/chat/unread-counts", {
            headers: { Authorization: `Bearer ${token}` },
          })
        ]);
        
        setChats(chatsRes.data);
        
        const unreadMap = {};
        unreadRes.data.forEach(item => {
          unreadMap[item.chatId] = item.unreadCount;
        });
        setUnreadCounts(unreadMap);
        
      } catch (error) {
        console.error("Error fetching chats:", error);
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          navigate("/");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchChats();
  }, [token, navigate]);

  const filteredChats = chats.filter(chat =>
    getChatName(chat).toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="w-full md:w-96 bg-white border-r border-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-96 bg-white border-r border-gray-200 flex flex-col relative">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Messages
          </h1>
          <div className="relative flex items-center group">
            <button
              onClick={() => setShowUserModal(true)}
              className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200"
            >
              <FaUserPlus className="text-sm" />
            </button>
            <span className="absolute -bottom-8 hidden group-hover:block whitespace-nowrap text-md text-white bg-black bg-opacity-75 px-2 py-1 rounded-md">
              New Chat
            </span>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 pl-10 rounded-lg bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all duration-200"
          />
          <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm" />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FaComments className="text-4xl mb-2" />
            <p>No conversations yet</p>
            <button
              onClick={() => setShowUserModal(true)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Start a new chat
            </button>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const unreadCount = unreadCounts[chat._id] || 0;
            
            return (
              <div
                key={chat._id}
                onClick={() => handleChatSelect(chat)}
                className={`flex items-center space-x-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200 ${
                  selectedChat?._id === chat._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="relative">
                  {getChatAvatar(chat) ? (
                    <img
                      src={getChatAvatar(chat)}
                      alt={getChatName(chat)}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                      {chat.isGroupChat ? (
                        <FaComments className="text-white text-xl" />
                      ) : (
                        <FaUserCircle className="text-white text-2xl" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {getChatName(chat)}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {getLastMessageTime(chat)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {chat.latestMessage?.content || "No messages yet"}
                  </p>
                </div>

                {unreadCount > 0 && (
                  <div className="bg-green-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Group Floating Button */}
      <div className="absolute bottom-6 right-4 group">
        <button
          onClick={handleCreateGroup}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 hover:scale-110"
        >
          <FaUsers className="text-white text-xl" />
        </button>
        <div className="absolute bottom-14 right-0 bg-black text-white text-xs px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Create Group
        </div>
      </div>

      {/* New Chat / Create Group Modal */}
      {showUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">
                {creatingGroup ? "Create Group Chat" : "Start New Chat"}
              </h2>
              <button
                onClick={resetGroupCreation}
                className="text-gray-400 hover:text-gray-600"
              >
                <FaTimes className="text-lg text-gray-500 hover:text-gray-800" />
              </button>
            </div>

            {creatingGroup ? (
              <>
                <div className="p-4 border-b border-gray-100">
                  <input
                    type="text"
                    placeholder="Enter group name..."
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                {groupMembers.length > 0 && (
                  <div className="p-4 border-b border-gray-100">
                    <p className="text-sm text-gray-600 mb-2">
                      Group Members ({groupMembers.length}/10):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {groupMembers.map((member) => (
                        <div
                          key={member._id}
                          className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-sm"
                        >
                          <span>{member.name}</span>
                          <button
                            onClick={() => removeUserFromGroup(member._id)}
                            className="hover:text-red-600"
                          >
                            <FaTimes className="text-xs" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4">
                  <input
                    type="text"
                    placeholder="Search users to add..."
                    value={groupSearchTerm}
                    onChange={(e) => {
                      setGroupSearchTerm(e.target.value);
                      searchUsers(e.target.value, true);
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto">
                  {groupSearchResults.length === 0 && groupSearchTerm && (
                    <div className="text-center text-gray-500 py-8">
                      No users found
                    </div>
                  )}
                  {groupSearchResults.map((user) => (
                    <div
                      key={user._id}
                      onClick={() => addUserToGroup(user)}
                      className="flex items-center justify-between space-x-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                    >
                      <div className="flex items-center space-x-3">
                        {user.profilePicture ? (
                          <img
                            src={user.profilePicture}
                            alt={user.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <FaUserCircle className="text-white text-xl" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{user.name}</h3>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                      <FaPlus className="text-green-500 text-sm" />
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-gray-200">
                  <button
                    onClick={createGroupChat}
                    disabled={creatingGroupLoading || !groupName.trim() || groupMembers.length < 2}
                    className="w-full py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creatingGroupLoading ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        <span>Creating Group...</span>
                      </>
                    ) : (
                      <>
                        <FaCheck />
                        <span>Create Group</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4">
                  <input
                    type="text"
                    placeholder="Search users by name or email..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      searchUsers(e.target.value, false);
                    }}
                    className="w-full px-4 py-2 rounded-lg bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex-1 overflow-y-auto">
                  {users.length === 0 && searchTerm && (
                    <div className="text-center text-gray-500 py-8">
                      No users found
                    </div>
                  )}
                  {users.map((user) => (
                    <div
                      key={user._id}
                      onClick={() => createNewChat(user._id)}
                      className="flex items-center space-x-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
                    >
                      {user.profilePicture ? (
                        <img
                          src={user.profilePicture}
                          alt={user.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                          <FaUserCircle className="text-white text-xl" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-medium text-gray-900">{user.name}</h3>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Chats;