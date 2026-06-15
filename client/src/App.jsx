import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Toast from "./components/Toast";
import Home from './pages/Home';
const App = () => {
  
  return (
    <>
      <Routes>
        <Route path='/' element={<Login />} />
        <Route path='/signup' element={<Signup />} />
        <Route path="/chats" element={<Home />} />
      </Routes>
      
            
    </>
  )
}

export default App
