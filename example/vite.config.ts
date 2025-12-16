import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default {
  plugins: [react()],
  server: {
    port: 3000,
  },
};
