use candid::{CandidType, Principal};
use ic_cdk::api::management_canister::ecdsa::{
    EcdsaCurve, EcdsaKeyId, EcdsaPublicKeyArgument, EcdsaPublicKeyResponse, SignWithEcdsaArgument,
    SignWithEcdsaResponse,
};
use ic_cdk::export::serde::{Deserialize, Serialize};
use ic_cdk_macros::*;

use std::collections::HashMap;
use std::str::FromStr;

#[derive(CandidType, Serialize, Debug)]
struct PublicKeyReply {
    pub public_key: Vec<u8>,
}

#[derive(CandidType, Serialize, Debug)]
struct SignatureReply {
    pub signature: Vec<u8>,
}

#[derive(Clone, Debug, CandidType, Deserialize, Default)]
struct State {
    pub keys: HashMap<Principal, Vec<u8>>,
    pub config: Config,
}

type CanisterId = Principal;

#[derive(CandidType, Deserialize, Debug, Clone, PartialEq, Default)]
pub enum Environment {
    #[default]
    Development,
    Staging,
    Production,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct Config {
    pub env: Environment,
    pub key_name: String,
    pub sign_cycles: u64,
}

impl Default for Config {
    fn default() -> Self {
        Self::from(Environment::Development)
    }
}

impl From<Environment> for Config {
    fn from(env: Environment) -> Self {
        if env == Environment::Staging {
            Self {
                env: Environment::Staging,
                key_name: "test_key_1".to_string(),
                sign_cycles: 10_000_000_000,
            }
        } else if env == Environment::Production {
            Self {
                env: Environment::Production,
                key_name: "key_1".to_string(),
                sign_cycles: 26_153_846_153,
            }
        } else {
            Self {
                env: Environment::Development,
                key_name: "dfx_test_key".to_string(),
                sign_cycles: 0,
            }
        }
    }
}

thread_local! {
    static STATE: std::cell::RefCell<State> = std::cell::RefCell::new(State::default());
}

// Pattern is taken from https://github.com/nikolas-con/ic-evm-sign
#[ic_cdk_macros::init]
fn init(env_opt: Option<Environment>) {
    if let Some(env) = env_opt {
        STATE.with(|s| {
            let mut state = s.borrow_mut();
            state.config = Config::from(env);
        })
    }
}

#[query]
fn public_key_query() -> Result<PublicKeyReply, String> {
    let pub_key = STATE.with(|s| {
        let state = s.borrow();
        state.keys.get(&ic_cdk::caller()).cloned()
    });

    if pub_key.is_some() {
        Ok(PublicKeyReply {
            public_key: pub_key.unwrap().clone(),
        })
    } else {
        Err("No public key found".to_string())
    }
}

#[update]
async fn public_key() -> Result<PublicKeyReply, String> {
    let caller = ic_cdk::caller();

    let key_name = STATE.with(|s| {
        let state = s.borrow();
        state.config.key_name.clone()
    });

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: key_name,
    };

    let ic_management_canister_id = "aaaaa-aa";
    let ic = CanisterId::from_str(ic_management_canister_id).unwrap();

    let request = EcdsaPublicKeyArgument {
        canister_id: None,
        derivation_path: vec![caller.as_slice().to_vec()],
        key_id,
    };
    let (res,): (EcdsaPublicKeyResponse,) = ic_cdk::call(ic, "ecdsa_public_key", (request,))
        .await
        .map_err(|e| format!("Failed to call ecdsa_public_key {}", e.1))?;

    //TODO: This in not secure
    STATE.with(|s| {
        let mut state = s.borrow_mut();
        state.keys.insert(caller, res.public_key.clone());
    });

    Ok(PublicKeyReply {
        public_key: res.public_key,
    })
}

#[update]
async fn sign(message: Vec<u8>) -> Result<SignatureReply, String> {
    assert!(message.len() == 32);

    let config = STATE.with(|s| {
        let state = s.borrow();
        state.config.clone()
    });

    let key_id = EcdsaKeyId {
        curve: EcdsaCurve::Secp256k1,
        name: config.key_name,
    };
    let ic_management_canister_id = "aaaaa-aa";
    let ic = CanisterId::from_str(ic_management_canister_id).unwrap();

    let caller = ic_cdk::caller().as_slice().to_vec();
    let request = SignWithEcdsaArgument {
        message_hash: message.clone(),
        derivation_path: vec![caller],
        key_id,
    };
    let (res,): (SignWithEcdsaResponse,) =
        ic_cdk::api::call::call_with_payment(ic, "sign_with_ecdsa", (request,), config.sign_cycles)
            .await
            .map_err(|e| format!("Failed to call sign_with_ecdsa {}", e.1))?;

    Ok(SignatureReply {
        signature: res.signature,
    })
}

#[pre_upgrade]
fn pre_upgrade() {
    let state = STATE.with(|s| s.borrow().clone());
    ic_cdk::storage::stable_save((state,)).unwrap();
}

#[post_upgrade]
fn post_upgrade() {
    let (s_prev,): (State,) = ic_cdk::storage::stable_restore().unwrap();

    STATE.with(|s| {
        *s.borrow_mut() = s_prev;
    });
}