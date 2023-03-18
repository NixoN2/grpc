import { createClient } from "redis";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const PROTO_PATH = "./api.proto";

const client = createClient();

client.on("error", (err) => console.log("Redis Client Error", err));

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  number: Number,
  defaults: true,
  oneofs: true,
});
const api_proto = grpc.loadPackageDefinition(packageDefinition).api;

async function createTodo(call, callback) {
  const todos = await client.lRange("todos", 0, -1).catch((error) => {
    console.log(error);
  });
  const parsedTodos = todos.map(JSON.parse);
  const todo = {
    name: call.request.name,
    description: call.request.description,
  };
  const foundTodo = parsedTodos.find((todo) => todo.name === call.request.name);
  if (foundTodo) {
    callback(
      {
        message: "todo with such name already exists",
        status: grpc.status.ALREADY_EXISTS,
      },
      null
    );
    return;
  }
  await client.rPush("todos", JSON.stringify(todo)).catch((error) => {
    console.log(error);
  });
  callback(null, { message: "todo created" });
}

async function getTodos(call, callback) {
  const { length, page } = call.request;
  const todos = await client.lRange("todos", 0, -1).catch((error) => {
    console.log(error);
  });
  const parsedTodos =
    page && length
      ? todos.map(JSON.parse).slice((page - 1) * length, page * length)
      : todos.map(JSON.parse);
  callback(null, { todos: parsedTodos });
}

async function deleteTodo(call, callback) {
  const { name } = call.request;
  const todos = await client.lRange("todos", 0, -1).catch((error) => {
    console.log(error);
  });
  const parsedTodos = todos
    .map(JSON.parse)
    .filter((todo) => todo.name !== name);
  if (todos.length !== parsedTodos.length) {
    await client.del("todos").catch((error) => console.log(error));
    const multi = await client.multi();
    await parsedTodos.map(async (todo) => {
      await multi.rPush("todos", JSON.stringify(todo));
    });
    await multi.exec(function (errors, results) {});
    callback(null, { message: "todo deleted" });
    return;
  }
  callback(
    {
      message: "todo with this name not found",
      status: grpc.status.NOT_FOUND,
    },
    null
  );
}

async function putTodo(call, callback) {
  const { name, description } = call.request;
  const todos = await client.lRange("todos", 0, -1).catch((error) => {
    console.log(error);
  });
  const parsedTodos = todos.map(JSON.parse);
  const foundTodoIndex = parsedTodos.findIndex((todo) => todo.name === name);
  if (foundTodoIndex < 0) {
    callback(
      {
        message: "todo with this name not found",
        status: grpc.status.NOT_FOUND,
      },
      null
    );
    return;
  }
  parsedTodos.splice(foundTodoIndex, 1, { name, description });
  await client.del("todos").catch((error) => console.log(error));
  const multi = await client.multi();
  await parsedTodos.map(async (todo) => {
    await multi.rPush("todos", JSON.stringify(todo));
  });
  await multi.exec(function (errors, results) {});
  callback(null, { message: "todo updated" });
}

async function main() {
  const server = new grpc.Server();
  await client.connect();
  server.addService(api_proto.Todos.service, {
    createTodo: createTodo,
    getTodos: getTodos,
    deleteTodo: deleteTodo,
    putTodo: putTodo,
  });
  server.bindAsync(
    "0.0.0.0:50051",
    grpc.ServerCredentials.createInsecure(),
    () => {
      server.start();
    }
  );
}

main().catch(() => {});
