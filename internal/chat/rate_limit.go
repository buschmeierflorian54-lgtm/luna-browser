package chat

import (
	"io"
	"net/http"
	"strconv"
	"time"
)

// Only retry a rejected request, never a partially received stream or a tool action.
func retryDelay(value string, attempt int) time.Duration {
	if seconds, err := strconv.Atoi(value); err == nil && seconds >= 0 {
		return time.Duration(seconds) * time.Second
	}
	if until, err := http.ParseTime(value); err == nil {
		d := time.Until(until)
		if d < 0 {
			return 0
		}
		return d
	}
	return time.Duration(5*(attempt+1)) * time.Second
}
func (c *Client) doRequest(req *http.Request) (*http.Response, error) {
	for attempt := 0; ; attempt++ {
		if err := req.Context().Err(); err != nil {
			return nil, err
		}
		copy := req.Clone(req.Context())
		if req.GetBody != nil {
			body, err := req.GetBody()
			if err != nil {
				return nil, err
			}
			copy.Body = body
		}
		resp, err := c.HTTP.Do(copy)
		if err != nil || resp.StatusCode != http.StatusTooManyRequests || attempt >= 2 {
			return resp, err
		}
		delay := retryDelay(resp.Header.Get("Retry-After"), attempt)
		// Do not retry earlier than requested; long waits are surfaced to the user.
		if delay > 30*time.Second {
			return resp, nil
		}
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		resp.Body.Close()
		if c.OnWait != nil {
			c.OnWait(delay)
		}
		if c.waitRetry != nil {
			if err := c.waitRetry(req.Context(), delay); err != nil {
				return nil, err
			}
		} else {
			timer := time.NewTimer(delay)
			select {
			case <-req.Context().Done():
				timer.Stop()
				return nil, req.Context().Err()
			case <-timer.C:
			}
		}
		if c.OnWait != nil {
			c.OnWait(0)
		}
	}
}
