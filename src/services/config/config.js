if(process.env.NODE_ENV === "production") {
    require('dotenv').config({ path: "/usr/src/app/.env.prod"});
} else if(process.env.NODE_ENV === "test") {
    require('dotenv').config({ path: "/usr/src/app/.env.test"});
} else {
    require('dotenv').config({ path: "/usr/src/app/.env"});
}