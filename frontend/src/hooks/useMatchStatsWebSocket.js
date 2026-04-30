import { useEffect, useCallback, useRef } from "react";

/**
 * Custom hook for WebSocket connection to match stats updates
 * @param {Function} onStatsUpdate - Callback function when stats are updated
 * @param {boolean} enabled - Whether to enable the WebSocket connection (default: true)
 */
export const useMatchStatsWebSocket = (onStatsUpdate, enabled = true) => {
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const shouldReconnectRef = useRef(enabled);

  // Determine the WebSocket URL based on the current location
  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/ws/match-stats`;
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (
      !shouldReconnectRef.current ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    try {
      const wsUrl = getWsUrl();
      console.log("Connecting to WebSocket:", wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log("WebSocket connected for match stats");
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received WebSocket message:", message);

          if (message.type === "stats_update") {
            // Call the callback with the match type key and stats
            if (onStatsUpdate) {
              onStatsUpdate({
                matchTypeKey: message.match_type_key,
                stats: message.stats,
              });
            }
          } else if (message.type === "match_complete") {
            console.log(
              `Match completed for ${message.match_type_key} in ${message.elapsed_time}s`
            );
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error, event.data);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current.onclose = () => {
        console.log("WebSocket disconnected");
        // Attempt to reconnect after 3 seconds if shouldReconnect is true
        if (shouldReconnectRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      // Attempt to reconnect after 3 seconds if shouldReconnect is true
      if (shouldReconnectRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      }
    }
  }, [getWsUrl, onStatsUpdate]);

  // Effect to handle enabled/disabled state
  useEffect(() => {
    shouldReconnectRef.current = enabled;

    if (enabled) {
      connect();
    } else {
      // Close the connection if disabling
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      // Clear any pending reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    }

    return () => {
      // Cleanup on unmount
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [enabled, connect]);

  // Return a function to manually disconnect
  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
  }, []);

  return {
    disconnect,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};
