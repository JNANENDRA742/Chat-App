import React from 'react'
import { useEffect } from 'react'

const Toast = ({ message, type, onClose }) => {

  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 6000)

    return () => clearTimeout(timer);
  }, [onClose])

  const toastStyles = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500",
  };
  return (
    <>
      <div className="fixed inset-0 bg-black opacity-50 z-40"></div>
      <div className={`fixed top-5 right-5 text-white px-5 py-3 z-41 rounded-lg shadow-md flex items-center justify-between min-w-[300px] animate-slideIn ${toastStyles[type] || toastStyles.warning}`}>
        <span>{message}</span>
        <button onClick={onClose} className="ml-4 text-white font-bold">X</button>
      </div>
    </>

  )
}

export default Toast
