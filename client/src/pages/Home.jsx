import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Chats from '../miscellaneous/Chats';
import ChattingPage from '../miscellaneous/ChattingPage';
import Navbar from '../miscellaneous/Navbar';

const Home = () => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const token = localStorage.getItem("token");

  // Check if device is mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleChatSelect = (chat) => {
    setSelectedChat(chat);
  };

  const handleBack = () => {
    setSelectedChat(null);
  };

  const handleChatUpdate = (chatId, latestMessage) => {
    console.log("Chat updated:", chatId, latestMessage);
  };

  const fetchTotalUnread = async () => {
    try {
      const response = await axios.get(
        "https://chat-app-backend-xpug.onrender.com/api/chat/total-unread",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTotalUnread(response.data.totalUnread);
    } catch (error) {
      console.error("Error fetching total unread:", error);
    }
  };

  const handleNotificationUpdate = () => {
    fetchTotalUnread();
  };

  useEffect(() => {
    if (token) {
      fetchTotalUnread();
    }
  }, [token]);

  return (
    <div className="h-screen flex flex-col">
      <Navbar totalUnread={totalUnread} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* ✅ Show Chats only when:
            1. On desktop (always show)
            2. On mobile AND no chat selected
        */}
        {(isMobile ? !selectedChat : true) && (
          <Chats 
            selectedChat={selectedChat} 
            onChatSelect={handleChatSelect}
            token={token}
            onNotificationUpdate={handleNotificationUpdate}
          />
        )}
        
        {/* ✅ Show ChattingPage only when:
            1. On desktop (always show - will show welcome screen if no chat)
            2. On mobile AND a chat is selected
        */}
        {(isMobile ? selectedChat : true) && (
          <ChattingPage 
            selectedChat={selectedChat}
            onBack={handleBack}
            token={token}
            onChatUpdate={handleChatUpdate}
            onNotificationUpdate={handleNotificationUpdate}
          />
        )}
      </div>
    </div>
  );
};

export default Home;