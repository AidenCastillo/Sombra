import socket

HOST = "0.0.0.0"  # Listen on all available network interfaces
PORT = 2323  # Non-privileged port (use 23 if running as root/admin)
VALUE_TO_SEND = "SOMBRA{remote_work_security_7e8f9g0h}\r\n"

with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as server:
    # Allow immediate reuse of the port after stopping the script
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind((HOST, PORT))
    server.listen()
    print(f"Listening for Telnet connections on port {PORT}...")

    while True:
        conn, addr = server.accept()
        with conn:
            print(f"Connected by {addr}")
            conn.sendall(VALUE_TO_SEND.encode("ascii"))
            # Exiting the 'with conn:' block automatically closes the socket
