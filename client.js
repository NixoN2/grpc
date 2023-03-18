import parseArgs from "minimist";
import grpc from "@grpc/grpc-js";
import protoLoader from "@grpc/proto-loader";

const PROTO_PATH = "./api.proto";

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const api_proto = grpc.loadPackageDefinition(packageDefinition).api;

const consoleArgs = process.argv;

const getParameter = (name) => {
  const consoleArg = consoleArgs.find((argument) => argument.startsWith(name));
  return consoleArg && consoleArg.split("=")[1];
};

const request = getParameter("method");
const name = getParameter("name");
const description = getParameter("description");
const page = getParameter("page");
const length = getParameter("length");

const createTodo = async (client) => {
  if (name && description) {
    await client.createTodo({ name, description }, function (err, response) {
      console.log(err || response);
    });
  } else {
    throw new Error("name or description were not provided");
  }
};

const getTodos = async (client) => {
  await client.getTodos({ page, length }, function (err, response) {
    console.log(err || response);
  });
};

const deleteTodo = async (client) => {
  if (name) {
    await client.deleteTodo({ name }, function (err, response) {
      console.log(err || response);
    });
  } else {
    throw new Error("name was not provided");
  }
};

const updateTodo = async (client) => {
  if (name && description) {
    await client.putTodo({ name, description }, function (err, response) {
      console.log(err || response);
    });
  } else {
    throw new Error("description or name were not provided");
  }
};

async function main() {
  const argv = parseArgs(process.argv.slice(2), {
    string: "target",
  });
  let target;
  if (argv.target) {
    target = argv.target;
  } else {
    target = "localhost:50051";
  }
  const client = new api_proto.Todos(target, grpc.credentials.createInsecure());
  switch (request) {
    case "get":
      getTodos(client).catch(console.log);
      break;
    case "post":
      createTodo(client).catch(console.log);
      break;
    case "put":
      updateTodo(client).catch(console.log);
      break;
    case "delete":
      deleteTodo(client).catch(console.log);
      break;
  }
}

main();
