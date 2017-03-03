/**
 * Created by ALiBH on 1/2/2017.
 */
var AWS = require("aws-sdk");
var sns = new AWS.SNS();
//var moment = require('moment');
//var shortid = require('shortid');
var attr = require('dynamodb-data-types').AttributeValue;
var dynamodb = new AWS.DynamoDB();
//AWS.config.loadFromPath('./config.json');
// var params = {
//     "TableName": TABLE_NAME,
//     "Limit": 2,
//     "ExclusiveStartKey": {
//         "customerID": {"N": "1"},
//         "orderTimeStamp": { "S": "2017-01-19T14:01:46.395" }
//     }
// };
//
// function scanDB(params) {
//     dynamodb.scan(params, function(err, data) {
//         if (err) {
//             console.error('error', err);
//         } else {
//             //console.log('items: ', JSON.stringify(data.Items, undefined, 2));
//             console.log('items: ', JSON.stringify(data, undefined, 2));
//             if (data.LastEvaluatedKey !== undefined) {
//                 console.log('more items available');
//             }
//         }
//     });
// }

exports.handler = function(event, context) {
    var resource = event.pathParameters.proxy;
    var parameter = event.queryStringParameters;
    var request =  event.httpMethod;
    //console.log(request+" "+resource+" "+parameter);
    //console.log(event);
    console.log("Event ", JSON.stringify(event, null, 2));
    switch (request)     {
        case 'GET' :
            switch (resource) {
                case 'restaurantlist' :
                    console.log("calling DB");
                    getRestaurants(context,parameter,dynamodb);
                    break;
                case 'adduser'  :
                    console.log("sending sms");
                    addUser(context,parameter);
                    break;
                case 'verifyuser' :
                    console.log("veryfing user");
                    verifyUser(context,parameter);
                    break;
                default:
                    defaultCase(context);
            }
            break;
        case 'POST' :
            switch (resource) {
                case 'updateuser' :
                    console.log("updating user info");
                    updateUser(context,event.body);
                    break;
                default:
                    defaultCase(context);
            }
            break;
        default:
            defaultCase(context);
    }
    //connection.end();
};

function getRestaurants(context,param,dynamodb){
    var params = {
        TableName : "restaurant",
        KeyConditionExpression: "#l_name = :xx",
        ExpressionAttributeNames:{
            "#l_name": "location_name"
        },
        ExpressionAttributeValues: {
            ":xx": {"S":param.location}
        }
    };
    dynamodb.query(params, function(err, data) {
        if (err) {
            console.error("Unable to query. Error:", JSON.stringify(err, null, 2));
            response(context,err);
        } else {
            console.log("Query succeeded.");
            console.log('items: ', JSON.stringify(data, undefined, 2));
            var unwrapped = [];
            for(x in data.Items) {
                unwrapped.push(attr.unwrap(data.Items[x]));
            }
            response(context,unwrapped);
        }
    });
}
function sms(context,param,code) {
    var params = {
        attributes: { /* required */
            DefaultSMSType  :   'Transactional',
            DefaultSenderID :   'FoodyPark'
            /* anotherKey: ... */
        }
    };
    sns.setSMSAttributes(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            response(context,err.stack);
        } // an error occurred
        else {
            console.log(data);
            response(context,data);
        }           // successful response
    });
    params = {
        Message: 'Your Verification code is '+code+'\n\n\n-Team FoodyPark', /* required */
        Subject: 'Testing Subject',
        PhoneNumber: '+91' + param.phno
    };
    sns.publish(params, function(err, data) {
        if (err) {
            console.log(err, err.stack);
            response(context,err.stack);
        } // an error occurred
        else {
            console.log(data);
            response(context,data);
        }           // successful response
    });
}
function addUser(context,param) {
    var data = {
        p_no            :   param.phno,
        isVerified      :   false,
        verificationCode:   Math.floor(Math.random() * (99999 - 10000))+10000
    };
    var opts = {
        TableName: "Users",
        Item: attr.wrap(data)
    };
    dynamodb.putItem(opts, function (err) {
        if (err) {
            console.error('error', err);
            response(context,err);
        } else {
            console.log('success');
            sms(context,param,data.verificationCode);
        }
    });
}
function verifyUser(context,param) {
    var params = {
        AttributesToGet: [
            "verificationCode"
        ],
        TableName : 'Users',
        Key : {
            "p_no" : {
                "S" : param.phno
            }
        }
    };

    dynamodb.getItem(params, function(err, data) {
        if (err) {
            console.log(err); // an error occurred
        }
        else {
            var resp = {
                status : "failed"
            };
            console.log(data.Item.verificationCode.N); // successful response
            if(param.code != data.Item.verificationCode.N) {
                response(context,resp);
            }
            resp.status = "success";
            verified(context,param,resp);
        }
    });
}
function verified(context,param,resp) {
    var params = {
        TableName:'Users',
        Key:{
            "p_no": {
                "S" :   param.phno
            }
        },
        UpdateExpression: "set #v = :r",
        ExpressionAttributeNames: {
            "#v": "isVerified",
        },
        ExpressionAttributeValues:{
            ":r":{
                    "BOOL" : true
            }
        }
    };
    console.log("Updating the item...");
    dynamodb.updateItem(params, function(err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
        } else {
            console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
            response(context,resp);
        }
    });
}
function updateUser(context,param) {
    var data = JSON.parse(param);
    console.log("event ", JSON.stringify(param, null, 2));
    console.log("data ", JSON.stringify(data, null, 2));
    var params = {
        TableName:'Users',
        Key:{
            "p_no": {
                "S" :   data.phno
            }
        },
        UpdateExpression: "set #n = :name,#l = :locality,#h = :house",
        ExpressionAttributeNames: {
            "#n": "Name",
            "#l": "Locality",
            "#h": "House"
        },
        ExpressionAttributeValues:{
            ":name":{
                "S" : data.name
            },
            ":locality":{
                "S" : data.locality
            },
            ":house": {
                "S": data.house
            }
        }
    };
    console.log("Updating the item...");
    var resp = {
        status : "failed"
    };
    dynamodb.updateItem(params, function(err, data) {
        if (err) {
            console.error("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
            response(context,resp);
        } else {
            console.log("UpdateItem succeeded:", JSON.stringify(data, null, 2));
            resp.status = "success";
            response(context,resp);
        }
    });
}
function defaultCase(context) {
    var responseCode = 400;
    //console.log("request: " + JSON.stringify(event));
    var response = {
        statusCode: responseCode,
        headers: {
            "x-custom-header" : "my custom header value"
        },
        body: JSON.stringify({"Error":"Not Found"})
    };
    context.succeed(response);
}
function response(context,result) {
    var responseCode = 200;
    //console.log("request: " + JSON.stringify(event));
    var response = {
        statusCode: responseCode,
        headers: {
            "x-custom-header" : "my custom header value"
        },
        body: JSON.stringify(result)
    };
    context.succeed(response);
}
//scanDB(params);