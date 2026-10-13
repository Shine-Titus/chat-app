import { useState } from "react";
import "./app.css"

const API = "http://localhost:8080";

function Register({ onBack }) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [mobile, setMobile] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        try {
            const res = await fetch(`${API}/auth/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password, mobile }),
            });

            if (res.status === 409) return setError("Username already taken");
            if (res.status === 400) return setError("Username and password are required");
            if (!res.ok) return setError("Something went wrong. Try again.");

            setSuccess("Account created. You can sign in now.");
            setUsername("");
            setPassword("");
            setMobile("");
        } catch {
            setError("Cannot reach the server");
        }
    };

    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleSubmit}>
                <h1>Sign up</h1>
                {error && <p className="login-error">{error}</p>}
                {success && <p className="login-success">{success}</p>}

                <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <input type="mobile" placeholder="Mobile Number" value={mobile} onChange={(e) => setMobile(e.target.value)} required />


                <button type="submit">Create account</button>

                <p className="auth-switch">
                    Already have an account?{" "}
                    <button type="button" className="link-button" onClick={onBack}>
                        Sign in
                    </button>
                </p>
            </form>
        </div>
    );
}

export default Register;