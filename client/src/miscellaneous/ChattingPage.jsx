import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { FaArrowLeft, FaPaperPlane, FaSmile, FaImage, FaUserCircle, FaTrash, FaPhone, FaVideo, FaComment, FaUserPlus, FaSpinner, FaEdit, FaSignOutAlt } from "react-icons/fa";
import io from "socket.io-client";

const ChattingPage = ({ selectedChat, onBack, token, onChatUpdate, onNotificationUpdate }) => {
  const ENDPOINT = "http://10.48.202.230:5000";
  const socket = useRef(null);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typing, setTyping] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  const [groupMembers, setGroupMembers] = useState([]);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);
  const [removingMember, setRemovingMember] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [renamingGroup, setRenamingGroup] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Get current user ID from token
  const getCurrentUserId = useCallback(() => {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      return decoded.id;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  }, [token]);

  const currentUserId = getCurrentUserId();

  // Get chat name
  const getChatName = () => {
    if (!selectedChat) return "";
    if (selectedChat.isGroupChat) {
      return selectedChat.chatName;
    } else {
      const otherUser = selectedChat.users?.find(user => user._id !== currentUserId);
      return otherUser?.name || "Unknown User";
    }
  };

  // Get chat avatar
  const getChatAvatar = () => {
    if (!selectedChat) return null;
    if (!selectedChat.isGroupChat) {
      const otherUser = selectedChat.users?.find(user => user._id !== currentUserId);
      return otherUser?.profilePicture || null;
    }
    return null;
  };

  // Get other user details
  const getOtherUser = () => {
    if (!selectedChat || selectedChat.isGroupChat) return null;
    return selectedChat.users?.find(user => user._id !== currentUserId);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // ✅ Reset unread count when opening chat
  const resetUnreadCount = async () => {
    if (!selectedChat) return;
    
    try {
      await axios.put(
        "http://10.48.202.230:5000/api/chat/reset-unread",
        { chatId: selectedChat._id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Notify parent component to update total unread count
      if (onNotificationUpdate) {
        onNotificationUpdate();
      }
    } catch (error) {
      console.error("Error resetting unread count:", error);
    }
  };

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!selectedChat) return;

    setLoadingMessages(true);
    try {
      const response = await axios.get(
        `http://10.48.202.230:5000/api/message/${selectedChat._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setMessages(response.data);
      scrollToBottom();
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoadingMessages(false);
    }
  }, [selectedChat, token]);

  // Send message
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !socketConnected) return;

    if (typing) {
      socket.current?.emit("typing", {
        chatId: selectedChat._id,
        userId: currentUserId,
        isTyping: false
      });
      setTyping(false);
    }

    setSending(true);
    try {
      const response = await axios.post(
        "http://10.48.202.230:5000/api/message",
        {
          content: newMessage,
          chatId: selectedChat._id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const newMessageData = response.data;
      setMessages(prev => [...prev, newMessageData]);
      
      // Emit socket event for real-time delivery
      if (socket.current && socketConnected) {
        socket.current.emit("new message", newMessageData);
      }
      
      setNewMessage("");
      scrollToBottom();

      if (onChatUpdate) {
        onChatUpdate(selectedChat._id, newMessageData);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Handle typing
  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!socketConnected) return;

    if (!typing) {
      setTyping(true);
      socket.current?.emit("typing", {
        chatId: selectedChat._id,
        userId: currentUserId,
        isTyping: true
      });
    }

    if (typingTimeout) clearTimeout(typingTimeout);

    const timeout = setTimeout(() => {
      socket.current?.emit("typing", {
        chatId: selectedChat._id,
        userId: currentUserId,
        isTyping: false
      });
      setTyping(false);
    }, 1000);

    setTypingTimeout(timeout);
  };

  // Check if user is online
  const isOtherUserOnline = () => {
    if (!selectedChat?.isGroupChat) {
      const otherUser = getOtherUser();
      if (!otherUser) return false;
      return onlineUsers.includes(otherUser._id);
    }
    return false;
  };

  // Initialize socket connection (only once)
  useEffect(() => {
    if (!currentUserId) return;

    // Only initialize socket if not already connected
    if (!socket.current) {
      socket.current = io(ENDPOINT, {
        transports: ["websocket"],
        withCredentials: true,
      });

      socket.current.on("connect", () => {
        console.log("Socket connected");
        socket.current.emit("setup", currentUserId);
      });

      socket.current.on("connected", () => {
        setSocketConnected(true);
        console.log("Socket setup complete");
      });

      socket.current.on("online users", (users) => {
        setOnlineUsers(users);
      });

      socket.current.on("disconnect", () => {
        console.log("Socket disconnected");
        setSocketConnected(false);
      });
    }

    return () => {
      // Don't disconnect on every re-render, only on component unmount
      if (socket.current && !selectedChat) {
        socket.current.disconnect();
        socket.current = null;
      }
    };
  }, [currentUserId]);

  // Handle message reception and notifications
  useEffect(() => {
    if (!socket.current || !socketConnected) return;

    const handleMessageReceived = (newMessageReceived) => {
      console.log("Message received:", newMessageReceived);
      
      // Check if message belongs to current selected chat
      if (selectedChat && newMessageReceived.chat?._id === selectedChat._id) {
        setMessages(prevMessages => {
          const exists = prevMessages.some(msg => msg._id === newMessageReceived._id);
          if (!exists) {
            setTimeout(() => scrollToBottom(), 100);
            return [...prevMessages, newMessageReceived];
          }
          return prevMessages;
        });
      }

      // Update chat list with latest message regardless of selected chat
      if (onChatUpdate) {
        onChatUpdate(newMessageReceived.chat?._id, newMessageReceived);
      }
    };

    // ✅ Handle notification updates
    const handleNotification = (data) => {
      console.log("Notification received:", data);
      
      // Show notification in UI (optional)
      // You can add a toast notification here
      
      // Update parent component to refresh unread counts
      if (onNotificationUpdate) {
        onNotificationUpdate();
      }
    };

    const handleUserTyping = ({ userId, isTyping }) => {
      if (userId !== currentUserId && selectedChat?._id) {
        setUserTyping(isTyping);
      }
    };

    socket.current.on("message received", handleMessageReceived);
    socket.current.on("user typing", handleUserTyping);
    socket.current.on("new notification", handleNotification);

    return () => {
      if (socket.current) {
        socket.current.off("message received", handleMessageReceived);
        socket.current.off("user typing", handleUserTyping);
        socket.current.off("new notification", handleNotification);
      }
    };
  }, [socketConnected, selectedChat, currentUserId, onChatUpdate, onNotificationUpdate]);

  // Join/leave chat room and reset unread count
  useEffect(() => {
    if (!selectedChat || !socket.current || !socketConnected) return;

    // Reset unread count when chat is opened
    resetUnreadCount();

    // Leave previous chat room
    if (socket.current.previousChatId && socket.current.previousChatId !== selectedChat._id) {
      socket.current.emit("leave chat", socket.current.previousChatId);
      console.log("Left previous chat room:", socket.current.previousChatId);
    }

    // Join new chat room
    socket.current.emit("join chat", selectedChat._id);
    socket.current.previousChatId = selectedChat._id;
    console.log("Joined chat room:", selectedChat._id);
    
    fetchMessages();
    
    if (selectedChat.isGroupChat) {
      fetchGroupMembers();
    }
    
    setUserTyping(false);
    
  }, [selectedChat, socketConnected, fetchMessages]);

  // Fetch group members
  const fetchGroupMembers = async () => {
    if (!selectedChat?._id) return;
    
    try {
      const response = await axios.get(`http://10.48.202.230:5000/api/chat/group/${selectedChat._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 200) {
        setGroupMembers(response.data.users);
      }
    } catch (error) {
      console.error("Error fetching group members:", error);
    }
  };

  // Fetch available users
  const fetchAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await axios.get("http://10.48.202.230:5000/api/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const filteredUsers = response.data.filter(
        (user) => user._id !== currentUserId && !groupMembers.some(member => member._id === user._id)
      );

      setAvailableUsers(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  // Handle user selection
  const handleUserSelection = (user) => {
    const alreadySelected = selectedUsers.some(u => u._id === user._id);
    if (alreadySelected) {
      setSelectedUsers(selectedUsers.filter(u => u._id !== user._id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  // Remove member from group
  const removeMemberFromGroup = async (userId) => {
    if (!selectedChat) return;
    if (currentUserId !== selectedChat.groupAdmin?._id) {
      alert("Only admin can remove members");
      return;
    }
    
    setRemovingMember(true);
    try {
      const response = await axios.put(
        "http://10.48.202.230:5000/api/chat/group/remove",
        {
          chatId: selectedChat._id,
          userId: userId,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      
      const updatedChat = response.data;
      setGroupMembers(updatedChat.users);
      alert("Member removed successfully");
      
      if (onChatUpdate) {
        onChatUpdate(updatedChat._id, null);
      }
    } catch (error) {
      console.error("Error removing member:", error);
      alert(error.response?.data?.message || "Error removing member");
    } finally {
      setRemovingMember(false);
    }
  };

  // Add members to group
  const addMembersToGroup = async () => {
    if (selectedUsers.length === 0) return;
    
    setAddingMembers(true);
    try {
      const response = await axios.put(
        "http://10.48.202.230:5000/api/chat/group/add",
        {
          chatId: selectedChat._id,
          userIds: selectedUsers.map(user => user._id),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert(`${selectedUsers.length} member(s) added successfully`);
      setSelectedUsers([]);
      setShowAddMembers(false);
      await fetchGroupMembers();
      
      if (onChatUpdate) {
        onChatUpdate(response.data._id, null);
      }
    } catch (error) {
      console.error("Error adding members:", error);
      alert(error.response?.data?.message || "Error adding members");
    } finally {
      setAddingMembers(false);
    }
  };

  // Rename group
  const handleRenameGroup = () => {
    setNewGroupName(getChatName());
    setShowRenameModal(true);
  };

  const saveGroupName = async () => {
    if (!newGroupName.trim()) {
      alert("Please enter a group name");
      return;
    }
    
    setRenamingGroup(true);
    try {
      const response = await axios.put(
        "http://10.48.202.230:5000/api/chat/group/rename",
        {
          chatId: selectedChat._id,
          chatName: newGroupName,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("Group name updated successfully");
      setShowRenameModal(false);
      
      // Update selected chat
      selectedChat.chatName = response.data.chatName;
      
      if (onChatUpdate) {
        onChatUpdate(selectedChat._id, null);
      }
    } catch (error) {
      console.error("Error renaming group:", error);
      alert(error.response?.data?.message || "Error renaming group");
    } finally {
      setRenamingGroup(false);
    }
  };

  // Leave group
  const leaveGroup = async () => {
    setLeavingGroup(true);
    try {
      await axios.put(
        "http://10.48.202.230:5000/api/chat/group/leave",
        {
          chatId: selectedChat._id,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      alert("You left the group");
      setShowLeaveConfirm(false);
      onBack(); // Go back to chat list
      
      if (onChatUpdate) {
        onChatUpdate(selectedChat._id, null);
      }
    } catch (error) {
      console.error("Error leaving group:", error);
      alert(error.response?.data?.message || "Error leaving group");
    } finally {
      setLeavingGroup(false);
    }
  };

  // Delete group
  const handleDeleteGroup = async () => {
    setDeletingGroup(true);
    try {
      await axios.delete(`http://10.48.202.230:5000/api/chat/group/${selectedChat._id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      alert("Group deleted successfully");
      setShowDeleteConfirm(false);
      onBack(); // Go back to chat list
      
      if (onChatUpdate) {
        onChatUpdate(selectedChat._id, null);
      }
    } catch (error) {
      console.error("Error deleting group:", error);
      alert(error.response?.data?.message || "Error deleting group");
    } finally {
      setDeletingGroup(false);
    }
  };

  if (!selectedChat) {
    return (
      <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <FaComment className="text-white text-4xl" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">Welcome to ChatHub</h2>
          <p className="text-gray-500">Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Connection Status Indicator */}
      {!socketConnected && (
        <div className="bg-yellow-100 text-yellow-800 text-xs text-center py-1">
          Connecting to real-time server...
        </div>
      )}

      {/* Chat Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <FaArrowLeft className="text-gray-600" />
          </button>

          <div 
            className="relative cursor-pointer" 
            onClick={() => {
              setShowDetails(!showDetails);
              if (selectedChat.isGroupChat && !showDetails) {
                fetchGroupMembers();
              }
            }}
          >
            {getChatAvatar() ? (
              <img
                src={getChatAvatar()}
                alt={getChatName()}
                className="w-10 h-10 rounded-full object-cover border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                <FaUserCircle className="text-white text-xl" />
              </div>
            )}
            {!selectedChat.isGroupChat && isOtherUserOnline() && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
            )}
          </div>

          <div>
            <h2 className="font-semibold text-gray-900">{getChatName()}</h2>
            <p className="text-xs text-gray-500">
              {userTyping ? (
                <span className="text-blue-500 italic">Typing...</span>
              ) : selectedChat.isGroupChat ? (
                `${groupMembers.length} members`
              ) : (
                isOtherUserOnline() ? "Online" : "Offline"
              )}
            </p>
          </div>
        </div>
        
        {selectedChat.isGroupChat && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                setShowAddMembers(true);
                fetchAvailableUsers();
                setShowDetails(false);
              }}
              className="p-2 hover:bg-gray-100 rounded-full transition-all duration-100"
              title="Add Members"
            >
              <FaUserPlus className="text-gray-600 text-xl" />
            </button>
          </div>
        )}
      </div>

      {/* Individual Chat Details Sidebar */}
      {showDetails && !selectedChat.isGroupChat && (
        <div className="absolute right-0 top-16 w-80 bg-white shadow-lg rounded-l-xl border-l border-gray-200 z-10 p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Contact Info</h3>
            <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
              ✕
            </button>
          </div>
          <div className="text-center mb-4">
            {getChatAvatar() ? (
              <img src={getChatAvatar()} alt={getChatName()} className="w-24 h-24 rounded-full object-cover mx-auto border" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
                <FaUserCircle className="text-white text-5xl" />
              </div>
            )}
            <h4 className="font-medium text-gray-900 mt-2">{getChatName()}</h4>
            <p className="text-sm text-gray-500">{getOtherUser()?.email}</p>
            <p className="text-xs text-gray-400 mt-1">
              {isOtherUserOnline() ? "● Online" : "○ Offline"}
            </p>
          </div>
        </div>
      )}

      {/* Group Info Sidebar */}
      {showDetails && selectedChat.isGroupChat && (
        <div className="absolute right-0 top-16 w-80 bg-white shadow-lg rounded-l-xl border-l border-gray-200 z-10 p-4 max-h-[85vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Group Info</h3>
            <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
              ✕
            </button>
          </div>
          
          <div className="text-center mb-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
              <FaUserCircle className="text-white text-5xl" />
            </div>
            
            {showRenameModal ? (
              <div className="mt-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowRenameModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 rounded-lg px-2 py-1 hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveGroupName}
                    disabled={renamingGroup}
                    className="flex-1 bg-blue-500 text-white rounded-lg px-2 py-1 hover:bg-blue-600 disabled:opacity-50"
                  >
                    {renamingGroup ? <FaSpinner className="animate-spin inline" /> : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h4 className="font-medium text-gray-900 mt-2">{getChatName()}</h4>
                {currentUserId === selectedChat.groupAdmin?._id && (
                  <button
                    onClick={handleRenameGroup}
                    className="bg-gray-200 text-gray-700 rounded-lg px-3 py-1 mt-2 hover:bg-gray-300 text-sm flex items-center gap-1 mx-auto"
                  >
                    <FaEdit className="text-xs" /> Change Name
                  </button>
                )}
              </>
            )}
            <p className="text-xs text-gray-500 mt-1">Group Chat</p>
          </div>
          
          <hr className="my-3" />
          
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-900">Members ({groupMembers.length})</h4>
            {currentUserId === selectedChat.groupAdmin?._id && (
              <button
                onClick={() => {
                  setShowAddMembers(true);
                  fetchAvailableUsers();
                  setShowDetails(false);
                }}
                className="text-blue-500 text-sm hover:underline"
              >
                + Add
              </button>
            )}
          </div>
          
          {groupMembers.map((member) => (
            <div key={member._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg mb-1">
              <div className="flex items-center gap-2">
                {member.profilePicture ? (
                  <img src={member.profilePicture} alt={member.name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <FaUserCircle className="text-2xl text-gray-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900 text-sm">{member.name}</p>
                  {member._id === selectedChat.groupAdmin?._id && (
                    <p className="text-xs text-blue-500">Admin</p>
                  )}
                </div>
              </div>
              {currentUserId === selectedChat.groupAdmin?._id && member._id !== currentUserId && (
                <button
                  onClick={() => removeMemberFromGroup(member._id)}
                  disabled={removingMember}
                  className="text-red-500 hover:text-red-700 text-sm disabled:opacity-50"
                >
                  {removingMember ? <FaSpinner className="animate-spin" /> : "Remove"}
                </button>
              )}
            </div>
          ))}

          <hr className="my-3" />
          
          {/* Leave Group Button */}
          {!showLeaveConfirm ? (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full mt-2 bg-red-50 text-red-600 py-2 rounded-lg hover:bg-red-100 transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <FaSignOutAlt /> Leave Group
            </button>
          ) : (
            <div className="mt-2 p-3 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600 mb-2">Are you sure you want to leave this group?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-1 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={leaveGroup}
                  disabled={leavingGroup}
                  className="flex-1 bg-red-600 text-white py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {leavingGroup ? <FaSpinner className="animate-spin inline" /> : "Yes, Leave"}
                </button>
              </div>
            </div>
          )}

          {/* Delete Group Button - Only show for admin */}
          {currentUserId === selectedChat.groupAdmin?._id && (
            <>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full mt-2 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <FaTrash /> Delete Group
                </button>
              ) : (
                <div className="mt-2 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-600 mb-2">Are you sure you want to delete this group? This action cannot be undone.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 bg-gray-200 text-gray-700 py-1 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteGroup}
                      disabled={deletingGroup}
                      className="flex-1 bg-red-600 text-white py-1 rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {deletingGroup ? <FaSpinner className="animate-spin inline" /> : "Yes, Delete"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembers && selectedChat.isGroupChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Add Members</h2>
              <button
                onClick={() => {
                  setShowAddMembers(false);
                  setSelectedUsers([]);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                ✕
              </button>
            </div>

            {selectedUsers.length > 0 && (
              <div className="p-4 border-b border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Selected ({selectedUsers.length}):</p>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((user) => (
                    <div key={user._id} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center gap-2 text-sm">
                      <span>{user.name}</span>
                      <button onClick={() => handleUserSelection(user)} className="font-bold hover:text-red-600">
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              <input
                type="text"
                placeholder="Search users..."
                className="w-full px-4 py-2 mb-4 rounded-lg bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500 outline-none"
                onChange={(e) => {
                  const searchTerm = e.target.value.toLowerCase();
                  if (searchTerm) {
                    const filtered = availableUsers.filter(user => 
                      user.name.toLowerCase().includes(searchTerm)
                    );
                    setAvailableUsers(filtered);
                  } else {
                    fetchAvailableUsers();
                  }
                }}
              />
              
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <FaSpinner className="animate-spin text-blue-500 text-2xl" />
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No users available to add
                </div>
              ) : (
                availableUsers.map((user) => (
                  <div key={user._id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg mb-2">
                    <div className="flex items-center gap-3">
                      {user.profilePicture ? (
                        <img src={user.profilePicture} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <FaUserCircle className="text-3xl text-gray-500" />
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedUsers.some(u => u._id === user._id)}
                      onChange={() => handleUserSelection(user)}
                      className="w-5 h-5 cursor-pointer"
                    />
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={addMembersToGroup}
                disabled={selectedUsers.length === 0 || addingMembers}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 rounded-lg hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {addingMembers ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>Add {selectedUsers.length} Member{selectedUsers.length !== 1 ? "s" : ""}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {loadingMessages ? (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FaComment className="text-4xl mb-2 opacity-50" />
            <p>No messages yet</p>
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = message.sender?._id === currentUserId;
              const showAvatar = !isOwnMessage && (index === 0 || messages[index - 1]?.sender?._id !== message.sender?._id);
              const showName = !isOwnMessage && selectedChat.isGroupChat && showAvatar;

              return (
                <div
                  key={message._id || index}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end gap-2 max-w-xs lg:max-w-md`}>
                    {!isOwnMessage && showAvatar && (
                      <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
                        {message.sender?.profilePicture ? (
                          <img
                            src={message.sender.profilePicture}
                            alt={message.sender.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                            <FaUserCircle className="text-white text-sm" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`${!isOwnMessage && !showAvatar ? 'ml-10' : ''}`}>
                      {showName && (
                        <p className="text-xs font-semibold text-gray-600 mb-1 ml-1">
                          {message.sender?.name}
                        </p>
                      )}
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          isOwnMessage
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                            : 'bg-white text-gray-900 shadow-sm'
                        }`}
                      >
                        <p className="text-sm break-words">{message.content}</p>
                      </div>
                      <p className={`text-xs text-gray-500 mt-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
                        {new Date(message.createdAt).toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <form onSubmit={sendMessage} className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={handleTyping}
            placeholder={socketConnected ? "Type a message..." : "Connecting to server..."}
            className="flex-1 px-4 py-2 rounded-full bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all duration-200"
            disabled={!socketConnected}
          />
          <button
            type="submit"
            disabled={sending || !newMessage.trim() || !socketConnected}
            className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
          >
            {sending ? (
              <FaSpinner className="animate-spin" />
            ) : (
              <FaPaperPlane />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChattingPage;

// import React, { useState, useEffect, useRef, useCallback } from "react";
// import axios from "axios";
// import { 
//   FaArrowLeft, FaPaperPlane, FaSmile, FaImage, FaUserCircle, 
//   FaTrash, FaPhone, FaVideo, FaInfoCircle, FaComment, FaPlus, 
//   FaUsers, FaUserPlus, FaUserMinus, FaCrown, FaSignOutAlt,
//   FaEdit, FaCheck, FaTimes, FaEllipsisV
// } from "react-icons/fa";
// import { formatDistanceToNow } from "date-fns";
// import io from "socket.io-client";

// const ChattingPage = ({ selectedChat, onBack, token, onChatUpdate }) => {
//   const ENDPOINT = "http://10.48.202.230:5000";
//   const socket = useRef(null);

//   const [messages, setMessages] = useState([]);
//   const [newMessage, setNewMessage] = useState("");
//   const [sending, setSending] = useState(false);
//   const [loadingMessages, setLoadingMessages] = useState(false);
//   const [showDetails, setShowDetails] = useState(false);
//   const [socketConnected, setSocketConnected] = useState(false);
//   const [typing, setTyping] = useState(false);
//   const [userTyping, setUserTyping] = useState(false);
//   const [typingTimeout, setTypingTimeout] = useState(null);
//   const [onlineUsers, setOnlineUsers] = useState([]);
  
//   // Group chat states
//   const [showAddMembers, setShowAddMembers] = useState(false);
//   const [showGroupInfo, setShowGroupInfo] = useState(false);
//   const [groupName, setGroupName] = useState("");
//   const [editingGroupName, setEditingGroupName] = useState(false);
//   const [newGroupName, setNewGroupName] = useState("");
//   const [availableUsers, setAvailableUsers] = useState([]);
//   const [selectedUsers, setSelectedUsers] = useState([]);
//   const [addingMembers, setAddingMembers] = useState(false);
//   const [removingMember, setRemovingMember] = useState(false);
//   const [updatingGroup, setUpdatingGroup] = useState(false);
  
//   const messagesEndRef = useRef(null);
//   const inputRef = useRef(null);

//   // Get current user ID from token
//   const getCurrentUserId = useCallback(() => {
//     try {
//       const decoded = JSON.parse(atob(token.split('.')[1]));
//       console.log("Decoded Token:", decoded);
//       return decoded.id;
//     } catch (error) {
//       console.error("Error decoding token:", error);
//       return null;
//     }
//   }, [token]);

//   const currentUserId = getCurrentUserId();

//   // Check if current user is admin of group
//   const isGroupAdmin = () => {
//     if (!selectedChat?.isGroupChat) return false;
//     return selectedChat.groupAdmin?._id === currentUserId;
//   };

//   // Get chat name (for group or individual)
//   const getChatName = () => {
//     if (!selectedChat) return "";
//     if (selectedChat.isGroupChat) {
//       return selectedChat.chatName;
//     } else {
//       const otherUser = selectedChat.users.find(user => user._id !== currentUserId);
//       return otherUser?.name || "Unknown User";
//     }
//   };

//   // Get chat avatar
//   const getChatAvatar = () => {
//     if (!selectedChat) return null;
//     if (!selectedChat.isGroupChat) {
//       const otherUser = selectedChat.users.find(user => user._id !== currentUserId);
//       return otherUser?.profilePicture || null;
//     }
//     return null;
//   };

//   // Get other user details (for individual chat)
//   const getOtherUser = () => {
//     if (!selectedChat || selectedChat.isGroupChat) return null;
//     return selectedChat.users.find(user => user._id !== currentUserId);
//   };

//   // Scroll to bottom of messages
//   const scrollToBottom = () => {
//     messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   };

//   // Fetch messages for selected chat
//   const fetchMessages = useCallback(async () => {
//     if (!selectedChat) return;

//     setLoadingMessages(true);
//     try {
//       const response = await axios.get(
//         `http://10.48.202.230:5000/api/message/${selectedChat._id}`,
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
//       setMessages(response.data);
//       scrollToBottom();
//     } catch (error) {
//       console.error("Error fetching messages:", error);
//     } finally {
//       setLoadingMessages(false);
//     }
//   }, [selectedChat, token]);

//   // Send message
//   const sendMessage = async (e) => {
//     e.preventDefault();
//     if (!newMessage.trim() || sending) return;

//     // Stop typing indicator
//     if (typing) {
//       socket.current.emit("typing", {
//         chatId: selectedChat._id,
//         userId: currentUserId,
//         isTyping: false
//       });
//       setTyping(false);
//     }

//     setSending(true);
//     try {
//       const response = await axios.post(
//         "http://10.48.202.230:5000/api/message",
//         {
//           content: newMessage,
//           chatId: selectedChat._id,
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//             "Content-Type": "application/json",
//           },
//         }
//       );

//       const newMessageData = response.data;
//       setMessages(prev => [...prev, newMessageData]);
//       socket.current.emit("new message", newMessageData);
//       setNewMessage("");
//       scrollToBottom();

//       // Update chat list with latest message
//       if (onChatUpdate) {
//         onChatUpdate(selectedChat._id, newMessageData);
//       }
//     } catch (error) {
//       console.error("Error sending message:", error);
//     } finally {
//       setSending(false);
//       inputRef.current?.focus();
//     }
//   };

//   // Handle typing indicator
//   const handleTyping = (e) => {
//     setNewMessage(e.target.value);

//     if (!socketConnected) return;

//     if (!typing) {
//       setTyping(true);
//       socket.current.emit("typing", {
//         chatId: selectedChat._id,
//         userId: currentUserId,
//         isTyping: true
//       });
//     }

//     // Clear previous timeout
//     if (typingTimeout) {
//       clearTimeout(typingTimeout);
//     }

//     // Set timeout to stop typing indicator
//     const timeout = setTimeout(() => {
//       socket.current.emit("typing", {
//         chatId: selectedChat._id,
//         userId: currentUserId,
//         isTyping: false
//       });
//       setTyping(false);
//     }, 1000);

//     setTypingTimeout(timeout);
//   };

//   // Check if other user is online (for individual chats)
//   const isOtherUserOnline = () => {
//     const otherUser = getOtherUser();
//     if (!otherUser) return false;
//     return onlineUsers.includes(otherUser._id);
//   };

//   // GROUP CHAT FUNCTIONS
  
//   // Fetch available users for adding to group
//   const fetchAvailableUsers = async () => {
//     try {
//       const response = await axios.get("http://10.48.202.230:5000/api/user", {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });
//       // Filter out users already in the group
//       const existingUserIds = selectedChat.users.map(user => user._id);
//       const available = response.data.filter(
//         user => !existingUserIds.includes(user._id) && user._id !== currentUserId
//       );
//       setAvailableUsers(available);
//     } catch (error) {
//       console.error("Error fetching users:", error);
//     }
//   };

//   // Add members to group
//   const addMembersToGroup = async () => {
//     if (selectedUsers.length === 0) return;
    
//     setAddingMembers(true);
//     try {
//       const response = await axios.put(
//         `http://10.48.202.230:5000/api/chat/group/add`,
//         {
//           chatId: selectedChat._id,
//           userIds: selectedUsers,
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
      
//       // Update the selected chat with new data
//       const updatedChat = response.data;
//       onChatUpdate?.(updatedChat._id, null);
      
//       // Refresh chat data
//       setSelectedUsers([]);
//       setShowAddMembers(false);
      
//       // Notify group members via socket
//       socket.current.emit("group updated", {
//         chatId: selectedChat._id,
//         updatedChat,
//       });
      
//       alert("Members added successfully!");
//     } catch (error) {
//       console.error("Error adding members:", error);
//       alert("Failed to add members");
//     } finally {
//       setAddingMembers(false);
//     }
//   };

//   // Remove member from group
//   const removeMemberFromGroup = async (userId) => {
//     if (!isGroupAdmin() && userId !== currentUserId) {
//       alert("Only group admin can remove members");
//       return;
//     }
    
//     setRemovingMember(true);
//     try {
//       const response = await axios.put(
//         `http://10.48.202.230:5000/api/chat/group/remove`,
//         {
//           chatId: selectedChat._id,
//           userId: userId,
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
      
//       const updatedChat = response.data;
      
//       // If current user was removed, go back to chat list
//       if (userId === currentUserId) {
//         alert("You have been removed from the group");
//         onBack();
//         return;
//       }
      
//       onChatUpdate?.(updatedChat._id, null);
      
//       // Notify group members via socket
//       socket.current.emit("group updated", {
//         chatId: selectedChat._id,
//         updatedChat,
//       });
      
//       alert("Member removed successfully!");
//     } catch (error) {
//       console.error("Error removing member:", error);
//       alert("Failed to remove member");
//     } finally {
//       setRemovingMember(false);
//     }
//   };

//   // Update group name
//   const updateGroupName = async () => {
//     if (!newGroupName.trim() || newGroupName === selectedChat.chatName) {
//       setEditingGroupName(false);
//       return;
//     }
    
//     setUpdatingGroup(true);
//     try {
//       const response = await axios.put(
//         `http://10.48.202.230:5000/api/chat/group/rename`,
//         {
//           chatId: selectedChat._id,
//           chatName: newGroupName,
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
      
//       const updatedChat = response.data;
//       onChatUpdate?.(updatedChat._id, null);
      
//       // Notify group members via socket
//       socket.current.emit("group updated", {
//         chatId: selectedChat._id,
//         updatedChat,
//       });
      
//       setEditingGroupName(false);
//       setGroupName(newGroupName);
//       alert("Group name updated successfully!");
//     } catch (error) {
//       console.error("Error updating group name:", error);
//       alert("Failed to update group name");
//     } finally {
//       setUpdatingGroup(false);
//     }
//   };

//   // Leave group
//   const leaveGroup = async () => {
//     if (!window.confirm("Are you sure you want to leave this group?")) return;
    
//     try {
//       const response = await axios.put(
//         `http://10.48.202.230:5000/api/chat/group/leave`,
//         {
//           chatId: selectedChat._id,
//         },
//         {
//           headers: {
//             Authorization: `Bearer ${token}`,
//           },
//         }
//       );
      
//       onBack(); // Go back to chat list
//       alert("You have left the group");
//     } catch (error) {
//       console.error("Error leaving group:", error);
//       alert("Failed to leave group");
//     }
//   };

//   // Delete group (admin only)
//   const deleteGroup = async () => {
//     if (!isGroupAdmin()) {
//       alert("Only group admin can delete the group");
//       return;
//     }
    
//     if (!window.confirm("Are you sure you want to delete this group? This action cannot be undone!")) return;
    
//     try {
//       await axios.delete(`http://10.48.202.230:5000/api/chat/group/${selectedChat._id}`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       });
      
//       onBack(); // Go back to chat list
//       alert("Group deleted successfully");
//     } catch (error) {
//       console.error("Error deleting group:", error);
//       alert("Failed to delete group");
//     }
//   };

//   // Initialize socket connection
//   useEffect(() => {
//     if (!currentUserId) return;

//     // Initialize socket
//     socket.current = io(ENDPOINT, {
//       transports: ["websocket"],
//       withCredentials: true,
//     });

//     // Setup event listeners
//     socket.current.on("connect", () => {
//       console.log("Socket connected");
//       socket.current.emit("setup", currentUserId);
//     });

//     socket.current.on("connected", () => {
//       setSocketConnected(true);
//       console.log("Socket setup complete");
//     });

//     socket.current.on("online users", (users) => {
//       setOnlineUsers(users);
//     });

//     socket.current.on("message received", (newMessageReceived) => {
//       console.log("SOCKET MESSAGE RECEIVED");
//       console.log(newMessageReceived);

//       // Check if the message belongs to current chat
//       if (selectedChat && newMessageReceived.chat._id === selectedChat._id) {
//         setMessages(prevMessages => {
//           // Avoid duplicate messages
//           const exists = prevMessages.some(msg => msg._id === newMessageReceived._id);
//           if (!exists) {
//             return [...prevMessages, newMessageReceived];
//           }
//           return prevMessages;
//         });
//         scrollToBottom();
//       }

//       // Update chat list to show latest message
//       if (onChatUpdate) {
//         onChatUpdate(newMessageReceived.chat._id, newMessageReceived);
//       }
//     });

//     socket.current.on("user typing", ({ userId, isTyping }) => {
//       if (userId !== currentUserId) {
//         setUserTyping(isTyping);
//       }
//     });
    
//     socket.current.on("group updated", ({ chatId, updatedChat }) => {
//       if (selectedChat && selectedChat._id === chatId) {
//         // Update the selected chat data
//         onChatUpdate?.(chatId, null);
//       }
//     });

//     socket.current.on("disconnect", () => {
//       console.log("Socket disconnected");
//       setSocketConnected(false);
//     });

//     // Cleanup
//     return () => {
//       if (socket.current) {
//         socket.current.off("connect");
//         socket.current.off("connected");
//         socket.current.off("message received");
//         socket.current.off("user typing");
//         socket.current.off("group updated");
//         socket.current.off("disconnect");
//         socket.current.disconnect();
//       }
//       if (typingTimeout) {
//         clearTimeout(typingTimeout);
//       }
//     };
//   }, [currentUserId, token, onChatUpdate, selectedChat]);

//   // Join chat room when selected chat changes
//   useEffect(() => {
//     if (!selectedChat || !socket.current || !socketConnected) return;

//     // Join new chat room
//     socket.current.emit("join chat", selectedChat._id);
//     console.log("Joined chat room:", selectedChat._id);

//     // Fetch messages for the new chat
//     fetchMessages();

//     // Reset typing indicators
//     setUserTyping(false);
    
//     // Set group name for editing
//     if (selectedChat.isGroupChat) {
//       setGroupName(selectedChat.chatName);
//       setNewGroupName(selectedChat.chatName);
//     }

//   }, [selectedChat, socketConnected, fetchMessages]);

//   if (!selectedChat) {
//     return (
//       <div className="hidden md:flex flex-1 flex-col items-center justify-center bg-gray-50">
//         <div className="text-center">
//           <div className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
//             <FaComment className="text-white text-4xl" />
//           </div>
//           <h2 className="text-2xl font-semibold text-gray-700 mb-2">Welcome to ChatHub</h2>
//           <p className="text-gray-500">Select a conversation to start chatting</p>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="flex-1 flex flex-col bg-white">
//       {/* Chat Header */}
//       <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
//         <div className="flex items-center space-x-3">
//           <button
//             onClick={onBack}
//             className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
//           >
//             <FaArrowLeft className="text-gray-600" />
//           </button>

//           <div 
//             className="relative cursor-pointer" 
//             onClick={() => selectedChat.isGroupChat ? setShowGroupInfo(!showGroupInfo) : setShowDetails(!showDetails)}
//           >
//             {getChatAvatar() ? (
//               <img
//                 key={getChatAvatar()}
//                 src={getChatAvatar()}
//                 alt={getChatName()}
//                 className="w-10 h-10 rounded-full object-cover border"
//               />
//             ) : (
//               <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
//                 {selectedChat.isGroupChat ? (
//                   <FaUsers className="text-white text-xl" />
//                 ) : (
//                   <FaUserCircle className="text-white text-xl" />
//                 )}
//               </div>
//             )}
//             {!selectedChat.isGroupChat && isOtherUserOnline() && (
//               <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
//             )}
//           </div>

//           <div>
//             {editingGroupName && selectedChat.isGroupChat ? (
//               <div className="flex items-center space-x-2">
//                 <input
//                   type="text"
//                   value={newGroupName}
//                   onChange={(e) => setNewGroupName(e.target.value)}
//                   className="px-2 py-1 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
//                   autoFocus
//                 />
//                 <button
//                   onClick={updateGroupName}
//                   disabled={updatingGroup}
//                   className="p-1 text-green-600 hover:bg-green-50 rounded"
//                 >
//                   <FaCheck />
//                 </button>
//                 <button
//                   onClick={() => {
//                     setEditingGroupName(false);
//                     setNewGroupName(groupName);
//                   }}
//                   className="p-1 text-red-600 hover:bg-red-50 rounded"
//                 >
//                   <FaTimes />
//                 </button>
//               </div>
//             ) : (
//               <div className="flex items-center space-x-2">
//                 <h2 className="font-semibold text-gray-900">{getChatName()}</h2>
//                 {selectedChat.isGroupChat && isGroupAdmin() && (
//                   <button
//                     onClick={() => setEditingGroupName(true)}
//                     className="text-gray-500 hover:text-gray-700"
//                   >
//                     <FaEdit className="text-sm" />
//                   </button>
//                 )}
//               </div>
//             )}
//             <p className="text-xs text-gray-500">
//               {userTyping ? (
//                 <span className="text-blue-500">Typing...</span>
//               ) : selectedChat.isGroupChat ? (
//                 `${selectedChat.users?.length || 0} members`
//               ) : (
//                 isOtherUserOnline() ? "Online" : "Offline"
//               )}
//             </p>
//           </div>
//         </div>

//         {selectedChat.isGroupChat && (
//           <div className="flex items-center space-x-2">
//             <button
//               onClick={() => {
//                 setShowAddMembers(true);
//                 fetchAvailableUsers();
//               }}
//               className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors duration-200"
//               title="Add Members"
//             >
//               <FaUserPlus className="text-sm" />
//             </button>
//             <button
//               onClick={() => setShowGroupInfo(!showGroupInfo)}
//               className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition-colors duration-200"
//               title="Group Info"
//             >
//               <FaInfoCircle className="text-sm" />
//             </button>
//           </div>
//         )}
//       </div>

//       {/* Group Info Sidebar */}
//       {showGroupInfo && selectedChat.isGroupChat && (
//         <div className="absolute right-0 top-16 w-80 bg-white shadow-lg rounded-l-xl border-l border-gray-200 z-10 p-4 max-h-[calc(100vh-4rem)] overflow-y-auto">
//           <div className="flex justify-between items-center mb-4">
//             <h3 className="font-semibold text-gray-900">Group Info</h3>
//             <button onClick={() => setShowGroupInfo(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
//               ✕
//             </button>
//           </div>
          
//           <div className="text-center mb-4">
//             <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
//               <FaUsers className="text-white text-3xl" />
//             </div>
//             <h4 className="font-medium text-gray-900 mt-2">{selectedChat.chatName}</h4>
//             <p className="text-xs text-gray-500">Group Chat</p>
//             {isGroupAdmin() && (
//               <span className="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
//                 Admin
//               </span>
//             )}
//           </div>

//           <div className="border-t pt-4">
//             <div className="flex justify-between items-center mb-3">
//               <h5 className="font-medium text-gray-900">Members ({selectedChat.users?.length})</h5>
//               {isGroupAdmin() && (
//                 <button
//                   onClick={() => {
//                     setShowAddMembers(true);
//                     fetchAvailableUsers();
//                   }}
//                   className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
//                 >
//                   <FaUserPlus /> Add
//                 </button>
//               )}
//             </div>
//             <div className="space-y-2 max-h-96 overflow-y-auto">
//               {selectedChat.users?.map((user) => (
//                 <div key={user._id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
//                   <div className="flex items-center space-x-3">
//                     {user.profilePicture ? (
//                       <img src={user.profilePicture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
//                     ) : (
//                       <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
//                         <FaUserCircle className="text-white" />
//                       </div>
//                     )}
//                     <div>
//                       <p className="text-sm font-medium text-gray-900">{user.name}</p>
//                       <p className="text-xs text-gray-500">
//                         {selectedChat.groupAdmin?._id === user._id ? "Admin" : "Member"}
//                       </p>
//                     </div>
//                   </div>
//                   {(isGroupAdmin() || user._id === currentUserId) && user._id !== selectedChat.groupAdmin?._id && (
//                     <button
//                       onClick={() => removeMemberFromGroup(user._id)}
//                       disabled={removingMember}
//                       className="text-red-500 hover:text-red-700 text-sm"
//                       title="Remove member"
//                     >
//                       <FaUserMinus />
//                     </button>
//                   )}
//                 </div>
//               ))}
//             </div>
//           </div>

//           <div className="border-t pt-4 mt-4 space-y-2">
//             {isGroupAdmin() && (
//               <button
//                 onClick={deleteGroup}
//                 className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center justify-center gap-2"
//               >
//                 <FaTrash /> Delete Group
//               </button>
//             )}
//             <button
//               onClick={leaveGroup}
//               className="w-full px-4 py-2 border border-red-500 text-red-500 rounded-lg hover:bg-red-50 transition-colors duration-200 flex items-center justify-center gap-2"
//             >
//               <FaSignOutAlt /> Leave Group
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Add Members Modal */}
//       {showAddMembers && selectedChat.isGroupChat && (
//         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
//           <div className="bg-white rounded-lg w-96 max-w-md p-6">
//             <div className="flex justify-between items-center mb-4">
//               <h3 className="text-xl font-semibold text-gray-900">Add Members</h3>
//               <button
//                 onClick={() => {
//                   setShowAddMembers(false);
//                   setSelectedUsers([]);
//                 }}
//                 className="text-gray-400 hover:text-gray-600"
//               >
//                 <FaTimes />
//               </button>
//             </div>
            
//             <div className="mb-4">
//               <p className="text-sm text-gray-600 mb-2">Select users to add to the group:</p>
//               <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
//                 {availableUsers.map((user) => (
//                   <label key={user._id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
//                     <input
//                       type="checkbox"
//                       checked={selectedUsers.includes(user._id)}
//                       onChange={(e) => {
//                         if (e.target.checked) {
//                           setSelectedUsers([...selectedUsers, user._id]);
//                         } else {
//                           setSelectedUsers(selectedUsers.filter(id => id !== user._id));
//                         }
//                       }}
//                       className="w-4 h-4 text-blue-600"
//                     />
//                     <div className="flex items-center space-x-3">
//                       {user.profilePicture ? (
//                         <img src={user.profilePicture} alt={user.name} className="w-8 h-8 rounded-full object-cover" />
//                       ) : (
//                         <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
//                           <FaUserCircle className="text-white" />
//                         </div>
//                       )}
//                       <div>
//                         <p className="text-sm font-medium text-gray-900">{user.name}</p>
//                         <p className="text-xs text-gray-500">{user.email}</p>
//                       </div>
//                     </div>
//                   </label>
//                 ))}
//                 {availableUsers.length === 0 && (
//                   <p className="text-center text-gray-500 py-4">No users available to add</p>
//                 )}
//               </div>
//             </div>
            
//             <div className="flex justify-end space-x-2">
//               <button
//                 onClick={() => {
//                   setShowAddMembers(false);
//                   setSelectedUsers([]);
//                 }}
//                 className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
//               >
//                 Cancel
//               </button>
//               <button
//                 onClick={addMembersToGroup}
//                 disabled={addingMembers || selectedUsers.length === 0}
//                 className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
//               >
//                 {addingMembers ? "Adding..." : `Add ${selectedUsers.length} Member${selectedUsers.length !== 1 ? 's' : ''}`}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* User Details Sidebar (Individual Chat) */}
//       {showDetails && !selectedChat.isGroupChat && (
//         <div className="absolute right-0 top-16 w-80 bg-white shadow-lg rounded-l-xl border-l border-gray-200 z-10 p-4">
//           <div className="flex justify-between items-center mb-4">
//             <h3 className="font-semibold text-gray-900">Contact Info</h3>
//             <button onClick={() => setShowDetails(false)} className="text-gray-400 hover:text-gray-600 text-2xl">
//               ✕
//             </button>
//           </div>
//           <div className="text-center mb-4">
//             {getChatAvatar() ? (
//               <img src={getChatAvatar()} alt={getChatName()} className="w-24 h-24 rounded-full object-cover mx-auto border" />
//             ) : (
//               <div className="w-24 h-24 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
//                 <FaUserCircle className="text-white text-5xl" />
//               </div>
//             )}
//             <h4 className="font-medium text-gray-900 mt-2">{getChatName()}</h4>
//             <p className="text-sm text-gray-500">{getOtherUser()?.email}</p>
//             <p className="text-xs mt-1">
//               {isOtherUserOnline() ? (
//                 <span className="text-green-500">● Online</span>
//               ) : (
//                 <span className="text-gray-400">Offline</span>
//               )}
//             </p>
//           </div>
//         </div>
//       )}

//       {/* Messages Area */}
//       <div className="flex-1 overflow-y-auto p-4 space-y-4">
//         {loadingMessages ? (
//           <div className="flex justify-center items-center h-full">
//             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
//           </div>
//         ) : messages.length === 0 ? (
//           <div className="flex flex-col items-center justify-center h-full text-gray-500">
//             <FaComment className="text-4xl mb-2 opacity-50" />
//             <p>No messages yet</p>
//             <p className="text-sm">Send a message to start the conversation</p>
//           </div>
//         ) : (
//           <>
//             {messages.map((message, index) => {
//               const isOwnMessage = message.sender?._id === currentUserId;
//               const showAvatar = !isOwnMessage && messages[index - 1]?.sender?._id !== message.sender?._id;

//               return (
//                 <div
//                   key={message._id || index}
//                   className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
//                 >
//                   <div className={`flex ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-xs lg:max-w-md`}>
//                     {!isOwnMessage && showAvatar && (
//                       <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mb-6">
//                         {message.sender?.profilePicture ? (
//                           <img
//                             src={message.sender.profilePicture}
//                             alt={message.sender.name}
//                             className="w-full h-full object-cover border rounded-full"
//                           />
//                         ) : (
//                           <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
//                             <FaUserCircle className="text-white text-sm" />
//                           </div>
//                         )}
//                       </div>
//                     )}
//                     <div className={`${!isOwnMessage && !showAvatar ? 'ml-10' : ''}`}>
//                       {!isOwnMessage && selectedChat.isGroupChat && !showAvatar && (
//                         <p className="text-xs text-gray-500 mb-1 ml-1">{message.sender?.name}</p>
//                       )}
//                       <div
//                         className={`px-4 py-2 rounded-lg ${isOwnMessage
//                           ? 'bg-green-700 text-white'
//                           : 'bg-gray-100 text-gray-900 shadow-sm'
//                           }`}
//                       >
//                         <p className="text-sm break-words">{message.content}</p>
//                       </div>
//                       <p className={`text-xs text-gray-500 mt-1 ${isOwnMessage ? 'text-right' : 'text-left'}`}>
//                         {new Date(message.createdAt).toLocaleString("en-IN", {
//                           timeZone: "Asia/Kolkata",
//                           hour: "2-digit",
//                           minute: "2-digit",
//                           hour12: true,
//                         })}
//                       </p>
//                     </div>
//                   </div>
//                 </div>
//               );
//             })}
//             <div ref={messagesEndRef} />
//           </>
//         )}
//       </div>

//       {/* Message Input */}
//       <form onSubmit={sendMessage} className="bg-white border-t border-gray-200 p-4">
//         <div className="flex items-center space-x-2">
//           <input
//             ref={inputRef}
//             type="text"
//             value={newMessage}
//             onChange={handleTyping}
//             placeholder={socketConnected ? "Type a message..." : "Connecting..."}
//             className="flex-1 px-4 py-2 rounded-full bg-gray-100 border border-transparent focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all duration-200"
//             disabled={!socketConnected}
//           />
//           <button
//             type="submit"
//             disabled={sending || !newMessage.trim() || !socketConnected}
//             className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full hover:from-blue-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
//           >
//             {sending ? (
//               <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
//             ) : (
//               <FaPaperPlane />
//             )}
//           </button>
//         </div>
//       </form>
//     </div>
//   );
// };

// export default ChattingPage;