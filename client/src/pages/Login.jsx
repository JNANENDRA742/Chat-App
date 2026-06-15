import React from 'react'
import axios from 'axios';
import Toast from '../components/Toast';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
const Login = () => {
    const [toast, setToast] = React.useState(null);
    const navigate = useNavigate();
    const showToast = (message, type) => {
        setToast({ message, type });
    };
    const [showPassword, setShowPassword] = React.useState(false)
    const [formData, setFormData] = React.useState({
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
        try {
            const loginData = {
                email: formData.email,
                password: formData.password
            };
            const response = await axios.post("http://10.48.202.230:5000/api/user/login", loginData);
            console.log(response.data);
            showToast(response.data.message, "success");
            localStorage.setItem("token", response.data.token);
            // localStorage.setItem("name", response.data.name);
            // localStorage.setItem("email", response.data.email);
            setTimeout(() => {
                navigate("/chats");
            }, 1500);
            clearForm();
        }
        catch (error) {
            console.log(error);
            showToast(error.response?.data?.message || "Something went wrong", "error");
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
                            />
                            <button
                                type='button'
                                onClick={togglePasswordVisibility}
                                className='px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-cyan-200  rounded-md transition-colors'
                            >
                                {showPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <button
                        type='submit'
                        className='w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 transition-colors'
                    >
                        Login
                    </button>
                </form>
                <Link to="/signup" className='block mt-4 text-center text-sm text-blue-500 hover:underline'>Don't have an account? Register</Link>
            </div>
            {
                toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )
            }
        </div>
    )
}

export default Login