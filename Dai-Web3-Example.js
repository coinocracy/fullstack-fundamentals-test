const Bank = artifacts.require("Bank");
const { expect } = require('chai');
const { BN, ether, balance } = require('@openzeppelin/test-helpers');
// Choices are:  `["BigNumber", "BN", "String"]
// Use https://github.com/indutny/bn.js/
Bank.numberFormat = "BN";
// ABIs are from https://github.com/ryanio/truffle-mint-dai/tree/master/test/abi
const daiABI = require("./abi/dai");
const usdcABI = require("./abi/erc20");

const daiContractAddress = "0x6b175474e89094c44da98b954eedeac495271d0f";
const daiContract = new web3.eth.Contract(daiABI, daiContractAddress);
const daiWhale = "0xF977814e90dA44bFA03b6295A0616a897441aceC";
// You can see an example of decimals in use by comparing the $25,039,869 in the
// contract under the Tokens field on Etherscan (as of writing) to the value
// below
// The Etherscan value can be found at https://etherscan.io/address/0xF977814e90dA44bFA03b6295A0616a897441aceC
daiWhaleBalance = daiContract.methods.balanceOf(daiWhale).call().then(
  function (value) { console.log("Balance of daiWhale: " + value); }
);

// Modify sendDai and setupDai to be a generic method for any ERC20 if you want
// test with USDC as well
const usdcContractAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const usdcContract = new web3.eth.Contract(daiABI, daiContractAddress);
const usdcWhale = "0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3";

const bankFeeAddress = "0xcD0Bf0039d0F09CF93f9a05fB57C2328F6D525A3";

// This function sends ETH to an address. This is only used to pay gas fees, you
// probably won't need this.
// Based on https://github.com/ryanio/truffle-mint-dai/blob/master/test/dai.js
async function sendEth(fromAccount, toAccount, amount) {
  await web3.eth.sendTransaction({
    from: fromAccount,
    to: toAccount,
    value: amount,
  });

  const ethBalance = await balance.current(daiWhale);
  assert.notEqual(
    ethBalance.toString(),
    0,
    "ethBalance should not be 0 after sending ETH",
  );

  return ethBalance;
}

// This function sends DAI to an address to initialize it with
// Based on https://github.com/ryanio/truffle-mint-dai/blob/master/test/dai.js
async function sendDai(fromAccount, toAccount, amount) {
  await daiContract.methods
    // Ether requires a string or a BN to avoid precision issues, and .transfer also requires a string
    .transfer(toAccount, amount.toString())
    .send({ from: fromAccount, gasLimit: 800000 });
  const daiBalance = await daiContract.methods.balanceOf(toAccount).call();
  console.log("Dai balance", daiBalance.toString());
  assert.notEqual(
    daiBalance.toString(),
    "0",
    "daiBalance should not be 0 after sending DAI",
  );

  return daiBalance;
}

async function setupDai(account, bankAddress, amountDai) {
  // Initialize daiWhale with ETH
  sendEth(account, daiWhale, ether(String(1)).toString());
  // Send Dai in units of ether
  amountDai = ether(amountDai.toString()).toString();
  const oldDaiBalance = await daiContract.methods.balanceOf(account).call();
  const sendDaiResult = await sendDai(daiWhale, account, amountDai);
  // Double check DAI balance (since this is a test after all)
  const newDaiBalance = await daiContract.methods.balanceOf(account).call();
  // Subtract the daiBalance so this doesn't fail on multiple runs
  let changedDaiBalance = newDaiBalance - oldDaiBalance;

  assert.equal(
    sendDaiResult,
    newDaiBalance,
    `sendDaiResult was ${sendDaiResult} newDaiBalance from contract was ${newDaiBalance}`,
  );

  assert.equal(
    changedDaiBalance,
    amountDai,
    `changedDaiBalance was ${changedDaiBalance} amountDai was ${amountDai}`,
  );
  assert.notEqual(
    0,
    newDaiBalance,
    "Account newDaiBalance after sending from Dai whale should not be 0",
  );

  // Approve sending the daiBalance from the user to the bank. Note that the
  // approval goes to the contract, since that is what executes the transferFrom
  // call.
  // See https://forum.openzeppelin.com/t/uniswap-transferfrom-error-dai-insufficient-allowance/4996/4
  // and https://forum.openzeppelin.com/t/example-on-how-to-use-erc20-token-in-another-contract/1682
  // This prevents the error "Dai/insufficient-allowance"
  // Setting an amount specifies the approval level
  await daiContract.methods
    .approve(bankAddress, amountDai)
    .send({ from: account, gasLimit: 800000 });

  // Check the approval amount
  const daiAllowance = await daiContract.methods
    .allowance(account.toString(), bankAddress)
    .call({ from: account });

  assert.equal(
    daiAllowance,
    amountDai,
    `daiAllowance was ${daiAllowance} while approval was for ${amountDai}`,
  );

  console.log("daiAllowance is " + daiAllowance);
}
