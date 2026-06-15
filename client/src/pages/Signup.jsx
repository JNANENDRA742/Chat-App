import { useState } from 'react'
import Toast from '../components/Toast';
import axios from 'axios';
import { Link } from 'react-router-dom';
const Signup = () => {
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
  };
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    profilePicture: null
  })

  const handleInputChange = (e) => {
    const { id, value, files } = e.target
    if (id === 'profilePicture') {
      setFormData(prev => ({
        ...prev,
        [id]: files[0] // Store the file object
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        [id]: value
      }))
    }
  }

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword)
  }
  const clearForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      profilePicture: null
    });
  };
  const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};
  const handleSubmit = async (e) => {

    e.preventDefault();

    try {
      let profilePictureUrl = "";
      if (formData.profilePicture) {
        profilePictureUrl = await convertToBase64(formData.profilePicture); // Convert the file to a base64 string for small files. For larger files, consider uploading to a cloud storage and using the URL.
      }

      const signupData = {
        name: formData.username,
        email: formData.email,
        password: formData.password,
        profilePicture: profilePictureUrl, // including profile picture
      };

      const response = await axios.post(
        "https://chat-app-backend-xpug.onrender.com/api/user/",
        signupData
      );

      console.log(response.data);

      showToast(response.data.message, "success");
      clearForm();
    } catch (error) {

      console.log(error);

      showToast(
        error.response?.data?.message || "Something went wrong",
        "error"
      );
    }
  };

  return (
    <div className='min-h-screen w-full bg-gray-100 shadow-lg flex items-center justify-center'>
      <div className='bg-white p-8 rounded shadow-md w-full max-w-md'>
        <h1 className='text-2xl font-semibold mb-6 text-center'>Signup Page</h1>
        <form onSubmit={handleSubmit}>
          <div className='mb-4'>
            <label htmlFor='username' className='block text-sm font-medium text-gray-700'>
              Username:
            </label>
            <input
              type='text'
              id='username'
              value={formData.username}
              onChange={handleInputChange}
              placeholder='Enter your username'
              className='mt-1 p-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
              required
            />
          </div>

          <div className='mb-4'>
            <label htmlFor='email' className='block text-sm font-medium text-gray-700'>
              Email:
            </label>
            <input
              type='email'
              id='email'
              value={formData.email}
              onChange={handleInputChange}
              placeholder='Enter your email'
              className='mt-1 p-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none'
              required
            />
          </div>

          <div className='mb-4'>
            <label htmlFor='password' className='block text-sm font-medium text-gray-700'>
              Password:
            </label>
            <div className='relative'>
              <input
                type={showPassword ? 'text' : 'password'}
                id='password'
                value={formData.password}
                onChange={handleInputChange}
                placeholder='Enter your password'
                className='p-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none pr-16'
                required
              />
              <button
                type='button'
                onClick={togglePasswordVisibility}
                className='absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800 hover:bg-cyan-200 rounded-md transition-colors px-3 py-1'
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>

          <div className='mb-4'>
            <label htmlFor="profilePicture" className="block text-sm font-medium text-gray-700">
              Profile Picture:
            </label>
            <input
              type="file"
              id="profilePicture"
              accept="image/*"
              onChange={handleInputChange}
              className="mt-1 p-2 w-full border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {formData.profilePicture && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {formData.profilePicture.name}
              </p>
            )}
          </div>

          <button
            type='submit'
            className='w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition duration-200'
          >
            Sign Up
          </button>
        </form>
        <Link to="/" className='block mt-4 text-center text-sm text-blue-500 hover:underline'>Already have an account? Login</Link>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}

export default Signup