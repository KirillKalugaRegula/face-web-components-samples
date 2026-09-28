import EnhancedApp from "./EnhancedApp";
import OriginalApp from "./OriginalApp";
import SampleLauncher from "./SampleLauncher";

function App() {
  switch (window.location.pathname) {
    case "/original":
      return <OriginalApp />;
    case "/enhanced":
      return <EnhancedApp />;
    default:
      return <SampleLauncher />;
  }
}

export default App;
