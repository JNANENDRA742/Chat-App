import React, { useState } from 'react'
import axios from 'axios';
import Toast from '../components/Toast';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FaSpinner } from 'react-icons/fa';

const Login = () => {
    const [toast, setToast] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    
    const showToast = (message, type) => {
        setToast({ message, type });
    };
    
    const [showPassword, setShowPassword] = useState(false)
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    })

    const handleInputChange = (e) => {
        const { id, value } = e.target
        setFormData(prev => ({
            ...prev,
            [id]: value
        }))
    }
    
    const clearForm = () => {
        setFormData({
            email: '',
            password: ''
        });
    };
    
    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword)
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Start loading
        setIsLoading(true);
        
        try {
            const loginData = {
                email: formData.email,
                password: formData.password
            };
            
            const response = await axios.post(
                "https://chat-app-backend-xpug.onrender.com/api/user/login", 
                loginData
            );
            
            console.log(response.data);
            showToast(response.data.message, "success");
            localStorage.setItem("token", response.data.token);
            
            setTimeout(() => {
                setIsLoading(false);
                navigate("/chats");
            }, 1500);
            
            clearForm();
        } catch (error) {
            console.log(error);
            showToast(error.response?.data?.message || "Something went wrong", "error");
            setIsLoading(false); // Stop loading on error
        }
    }

    return (
        <div className='min-h-screen w-full p-4 flex items-center justify-center bg-gray-100'>
            <div className='bg-white p-6 rounded-lg shadow-md w-full max-w-md'>
                <h1 className='text-2xl font-semibold mb-6 text-center'>Login Page</h1>
                
                <form onSubmit={handleSubmit}>
                    <div className='mb-4'>
                        <label htmlFor='email' className='block text-sm font-medium text-gray-700'>
                            Email:
                        </label>
                        <input
                            type='email'
                            id='email'
                            value={formData.email}
                            onChange={handleInputChange}
                            placeholder='Enter your email :'
                            className='mt-1 p-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
                            required
                            disabled={isLoading}
                        />
                    </div>

                    <div className='mb-4'>
                        <label htmlFor='password' className='block text-sm font-medium text-gray-700'>
                            Password:
                        </label>
                        <div className='flex items-center border rounded-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500'>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                id='password'
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder='Enter your password :'
                                className='p-2 w-full outline-none rounded-l-md'
                                required
                                disabled={isLoading}
                            />
                            <button
                                type='button'
                                onClick={togglePasswordVisibility}
                                className='px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-cyan-200 rounded-md transition-colors'
                                disabled={isLoading}
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <button
                        type='submit'
                        disabled={isLoading}
                        className='w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                    >
                        {isLoading ? (
                            <>
                                <FaSpinner className="animate-spin" />
                                <span>Logging in...</span>
                            </>
                        ) : (
                            <span>Login</span>
                        )}
                    </button>
                </form>
                
                <Link to="/signup" className='block mt-4 text-center text-sm text-blue-500 hover:underline'>
                    Don't have an account? Register
                </Link>
            </div>
            
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    )
}

export default Login
