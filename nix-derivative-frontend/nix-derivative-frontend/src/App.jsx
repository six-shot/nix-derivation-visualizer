import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import GraphComponent from './components/Graph'
import FetchGraph from './components/FetchGraph'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <FetchGraph />
    </>
  );
}

export default App;
