import React from 'react';

const Header = () => {
  return (
    <header className="w-full items-center bg-white py-2 px-6 hidden sm:flex">
      <div className="w-1/2"></div>
      <div className="relative w-1/2 flex justify-end">
        <button className="relative z-10 w-12 h-12 rounded-full overflow-hidden border-4 border-gray-400 hover:border-gray-300 focus:border-gray-300 focus:outline-none">
          <img src="https://source.unsplash.com/uJ8LNVCBjFQ/400x400" alt="User" />
        </button>
      </div>
    </header>
  );
};

export default Header;