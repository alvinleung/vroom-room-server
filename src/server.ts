import fs from "fs";
import path from "path";
import { createServer as createHttpsServer } from "https";
import { createServer as createHttpServer } from "http";

import { Server, Socket } from "socket.io";

import dotenv from "dotenv";
import { networkInterfaces } from "os";
import { UserState } from "./user";

dotenv.config(); // Load .env

// SETUP SSL AND SERVER
const protocol = process.env.PROTOCOL;
const keyPath = process.env.SSL_KEY_PATH!;
const certPath = process.env.SSL_CERT_PATH!;
const port = process.env.PORT;

const key = fs.readFileSync(path.resolve(keyPath), "utf8");
const cert = fs.readFileSync(path.resolve(certPath), "utf8");

const httpServer = (() => {
  if (protocol === "http") {
    return createHttpServer();
  }
  return createHttpsServer({
    key,
    cert,
  });
})();

const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

// SERVER LOGIC
const allUsers = new Set<UserState>();

io.on("connection", (socket: Socket) => {
  const room = "main-room";
  socket.join(room);

  console.log(`user ${socket.id} disconnected`);

  const user: UserState = {
    id: socket.id,
    name: "",
    x: 0,
    y: 0,
    velX: 0,
    velY: 0,
    message: "",
    color: "",
  };

  // add user here
  allUsers.add(user);
  socket.to(room).emit("user-add", user);

  socket.on("fetch-others", (callback) => {
    // fetch all the users
    callback([...allUsers].filter((u) => u !== user));
  });

  socket.on("emit-user-update", (state: Partial<UserState>) => {
    Object.assign(user, state);

    // propagate the user state update to other user
    socket.to(room).emit("user-update", state);
  });

  socket.on("disconnect", () => {
    io.to(room).emit("user-delete", user);
    allUsers.delete(user);
    console.log(`user ${socket.id} disconnected`);
  });
});

// START LISTENING TO INCOMING CONNECTIONS
httpServer.listen(port, () => {
  const address = (() => {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (net.family === "IPv4" && !net.internal) {
          return net.address;
        }
      }
    }
    return "localhost"; // Fallback to localhost if no external IP is found
  })();

  console.log(
    "------------------------------------------------------------------------",
  );
  console.log(`WebSocket server running on ${protocol}://${address}:${port}`);
  console.log("Environment: ", process.env.NODE_ENV!);
  console.log(
    "------------------------------------------------------------------------",
  );
});
