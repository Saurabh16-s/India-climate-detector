import { useState } from 'react';
import { subscribe } from '../api';

const WHAT = {
  Flood: 'We email you when the 5-day forecast shows heavy rain (64.5 mm a day or more) here.',
  Drought: 'We email you a once-a-year advisory when the monsoon season starts.',
};

export default function SubscribeBox({ state, district, hazard }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [msg, setMsg] = useState('');

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      setMsg(await subscribe({ state, district, email }));
      setStatus('done');
    } catch (err) {
      setMsg(err.message);
      setStatus('error');
    }
  };

  return (
    <div className="alert">
      <b>Get email alerts for {district}</b>
      {status === 'done' ? (
        <div className="msg">{msg}</div>
      ) : (
        <>
          <form onSubmit={onSubmit}>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              aria-label="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending...' : 'Notify me'}
            </button>
          </form>
          {status === 'error' && <div className="msg err">{msg}</div>}
          <div className="msg">{WHAT[hazard]} Unsubscribe anytime.</div>
        </>
      )}
    </div>
  );
}
