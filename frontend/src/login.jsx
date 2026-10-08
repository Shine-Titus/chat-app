import { useState } from "react";
import "./app.css"

function Login({ onLogin, error }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    return (
        <div className='login-container'>
            <form className="login-form" onSubmit={(e) => { e.preventDefault(); onLogin(username, password) }}>
                <h1>Sign in</h1>
                {error && <p className="login-error">{error}</p>}
                <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button type="submit">Sign In</button>
            </form>
        </div>
    )
};

export default Login;