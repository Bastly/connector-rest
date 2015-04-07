# connector-rest

# Command line options
To get the help

    node connector-rest -help
 
# API calls and examples to ORION

Create element

POST http://ORION_IP:1026/v1/updateContext
    
    {
    "contextElements": [
        {
            "type": "BastlyMSG",
            "isPattern": "false",
            "id": "BastlyKey:1234:userId:1234",
            "attributes": [
            {
                "name": "temperature",
                "type": "float",
                "value": "23"
            },
            {
                "name": "pressure",
                "type": "integer",
                "value": "720"
            }
            ]
        }
    ],
    "updateAction": "APPEND"
    }
    
    
Element update

POST http://ORION_IP:1026/v1/updateContext

    {
    "contextElements": [
        {
            "type": "BastlyMSG",
            "isPattern": "false",
            "id": "BastlyKey:1234:userId:1234",
            "attributes": [
            {
                "name": "temperature",
                "type": "float",
                "value": "26.4"
            }
            ]
        }
    ],
    "updateAction": "UPDATE"
    }

Add channel field to element

POST http://ORION_IP:1026/v1/updateContext

    {
    "contextElements": [
        {
            "type": "BastlyMSG",
            "isPattern": "false",
            "id": "BastlyKey:1234:userId:1234",
            "attributes": [
            {
                "name": "channels",
                "type": "channel",
                "value": ["1234","12345"]
            }
            ]
        }
    ],
    "updateAction": "APPEND"
    }
    
  Query elements
  
  POST http://ORION_IP:1026/v1/queryContext
     
    {
    "entities": [
        {
            "type": "BastlyMSG",
            "isPattern": "true",
            "id": "BastlyKey:*"
        }
    ]
    }

# Data forwarded to Atahualpa

    { 
        type: 'BastlyMSG',
        isPattern: 'false',
        id: 'BastlyKey:1234:userId:1234',
        attributes: 
        [ 
            { name: 'temperature', type: 'float', value: '23' },
            { name: 'pressure', type: 'integer', value: '720' } 
        ] 
    }
