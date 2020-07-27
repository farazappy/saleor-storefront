import React, { useEffect, useRef, useState, useCallback } from "react";
import { useIntl } from "react-intl";
import { Redirect, useLocation } from "react-router-dom";

import { Button, Loader } from "@components/atoms";
import { CheckoutProgressBar } from "@components/molecules";
import { CartSummary } from "@components/organisms";
import { Checkout } from "@components/templates";
import { useCart, useCheckout } from "@saleor/sdk";
import { IItems } from "@saleor/sdk/lib/api/Cart/types";
import { CHECKOUT_STEPS } from "@temp/core/config";
import { checkoutMessages } from "@temp/intl";
import { ITaxedMoney } from "@types";

import { usePaymentGatewaysHandlers } from "@hooks/usePaymentGatewaysHandlers";
import { CheckoutRouter } from "./CheckoutRouter";
import {
  CheckoutAddressSubpage,
  CheckoutPaymentSubpage,
  CheckoutReviewSubpage,
  CheckoutShippingSubpage,
  ICheckoutAddressSubpageHandles,
  ICheckoutPaymentSubpageHandles,
  ICheckoutReviewSubpageHandles,
  ICheckoutShippingSubpageHandles,
} from "./subpages";
import { IProps } from "./types";

const prepareCartSummary = (
  totalPrice?: ITaxedMoney | null,
  subtotalPrice?: ITaxedMoney | null,
  shippingTaxedPrice?: ITaxedMoney | null,
  promoTaxedPrice?: ITaxedMoney | null,
  items?: IItems
) => {
  const products = items?.map(({ id, variant, totalPrice, quantity }) => ({
    id: id || "",
    name: variant.name || "",
    price: {
      gross: {
        amount: totalPrice?.gross.amount || 0,
        currency: totalPrice?.gross.currency || "",
      },
      net: {
        amount: totalPrice?.net.amount || 0,
        currency: totalPrice?.net.currency || "",
      },
    },
    quantity,
    sku: variant.sku || "",
    thumbnail: {
      alt: variant.product?.thumbnail?.alt || undefined,
      url: variant.product?.thumbnail?.url,
      url2x: variant.product?.thumbnail2x?.url,
    },
  }));

  return (
    <CartSummary
      shipping={shippingTaxedPrice}
      subtotal={subtotalPrice}
      promoCode={promoTaxedPrice}
      total={totalPrice}
      products={products}
    />
  );
};

const getCheckoutProgress = (
  loaded: boolean,
  activeStepIndex: number,
  isShippingRequired: boolean
) => {
  const steps = isShippingRequired
    ? CHECKOUT_STEPS
    : CHECKOUT_STEPS.filter(
        ({ onlyIfShippingRequired }) => !onlyIfShippingRequired
      );

  return loaded ? (
    <CheckoutProgressBar steps={steps} activeStep={activeStepIndex} />
  ) : null;
};

const getButton = (text: string, onClick: () => void) => {
  if (text) {
    return (
      <Button
        testingContext="checkoutPageNextStepButton"
        onClick={onClick}
        type="submit"
      >
        {text}
      </Button>
    );
  }
  return null;
};

const CheckoutPage: React.FC<IProps> = ({}: IProps) => {
  const { pathname } = useLocation();
  const {
    loaded: cartLoaded,
    shippingPrice,
    discount,
    subtotalPrice,
    totalPrice,
    items,
  } = useCart();
  const {
    loaded: checkoutLoaded,
    checkout,
    payment,
    availablePaymentGateways,
    completeCheckout,
  } = useCheckout();
  const intl = useIntl();

  if (cartLoaded && (!items || !items?.length)) {
    return <Redirect to="/cart/" />;
  }

  const [submitInProgress, setSubmitInProgress] = useState(false);

  const [selectedPaymentGateway, setSelectedPaymentGateway] = useState<
    string | undefined
  >(payment?.gateway);
  const [paymentData, setPaymentData] = useState<any>();
  const [
    selectedPaymentGatewayToken,
    setSelectedPaymentGatewayToken,
  ] = useState<string | undefined>(payment?.token);

  useEffect(() => {
    setSelectedPaymentGateway(payment?.gateway);
  }, [payment?.gateway]);
  useEffect(() => {
    setSelectedPaymentGatewayToken(payment?.token);
  }, [payment?.token]);

  const paymentGatewaysHandlers = usePaymentGatewaysHandlers({
    availablePaymentGateways,
    onSubmitPayment: state =>
      completeCheckout(state, "http://127.0.0.1:3000/redirected/"),
  });

  const matchingStepIndex = CHECKOUT_STEPS.findIndex(
    ({ link }) => link === pathname
  );
  const activeStepIndex = matchingStepIndex !== -1 ? matchingStepIndex : 3;
  const activeStep = CHECKOUT_STEPS[activeStepIndex];

  const checkoutAddressSubpageRef = useRef<ICheckoutAddressSubpageHandles>(
    null
  );
  const checkoutShippingSubpageRef = useRef<ICheckoutShippingSubpageHandles>(
    null
  );
  const checkoutPaymentSubpageRef = useRef<ICheckoutPaymentSubpageHandles>(
    null
  );
  const checkoutReviewSubpageRef = useRef<ICheckoutReviewSubpageHandles>(null);

  const handleNextStepClick = () => {
    // Some magic above and below ensures that the activeStepIndex will always
    // be in 0-3 range
    /* eslint-disable default-case */
    switch (activeStepIndex) {
      case 0:
        if (checkoutAddressSubpageRef.current?.submitAddress) {
          checkoutAddressSubpageRef.current?.submitAddress();
        }
        break;
      case 1:
        if (checkoutShippingSubpageRef.current?.submitShipping) {
          checkoutShippingSubpageRef.current?.submitShipping();
        }
        break;
      case 2:
        if (checkoutPaymentSubpageRef.current?.submitPayment) {
          checkoutPaymentSubpageRef.current?.submitPayment();
        }
        break;
      case 3:
        if (checkoutReviewSubpageRef.current?.complete) {
          checkoutReviewSubpageRef.current?.complete();
        }
        break;
    }
  };
  const shippingTaxedPrice =
    checkout?.shippingMethod?.id && shippingPrice
      ? {
          gross: shippingPrice,
          net: shippingPrice,
        }
      : null;
  const promoTaxedPrice = discount && {
    gross: discount,
    net: discount,
  };

  const checkoutView =
    cartLoaded && checkoutLoaded ? (
      <CheckoutRouter
        items={items}
        checkout={checkout}
        payment={payment}
        renderAddress={props => (
          <CheckoutAddressSubpage
            ref={checkoutAddressSubpageRef}
            changeSubmitProgress={setSubmitInProgress}
            {...props}
          />
        )}
        renderShipping={props => (
          <CheckoutShippingSubpage
            ref={checkoutShippingSubpageRef}
            changeSubmitProgress={setSubmitInProgress}
            {...props}
          />
        )}
        renderPayment={props => (
          <CheckoutPaymentSubpage
            ref={checkoutPaymentSubpageRef}
            selectedPaymentGateway={selectedPaymentGateway}
            selectedPaymentGatewayToken={selectedPaymentGatewayToken}
            paymentGatewaysHandlers={paymentGatewaysHandlers}
            changeSubmitProgress={setSubmitInProgress}
            selectPaymentGateway={setSelectedPaymentGateway}
            setPaymentData={setPaymentData}
            {...props}
          />
        )}
        renderReview={props => (
          <CheckoutReviewSubpage
            ref={checkoutReviewSubpageRef}
            selectedPaymentGatewayToken={selectedPaymentGatewayToken}
            paymentData={paymentData}
            paymentGatewaysHandlers={paymentGatewaysHandlers}
            changeSubmitProgress={setSubmitInProgress}
            {...props}
          />
        )}
      />
    ) : (
      <Loader />
    );

  const isShippingRequiredForProducts =
    items &&
    items.some(
      ({ variant }) => variant.product?.productType.isShippingRequired
    );

  let buttonText = activeStep.nextActionName;
  /* eslint-disable default-case */
  switch (activeStep.nextActionName) {
    case "Continue to Shipping":
      buttonText = intl.formatMessage(checkoutMessages.addressNextActionName);
      break;
    case "Continue to Payment":
      buttonText = intl.formatMessage(checkoutMessages.shippingNextActionName);
      break;
    case "Continue to Review":
      buttonText = intl.formatMessage(checkoutMessages.paymentNextActionName);
      break;
    case "Place order":
      buttonText = intl.formatMessage(checkoutMessages.reviewNextActionName);
      break;
  }

  return (
    <Checkout
      loading={submitInProgress}
      navigation={getCheckoutProgress(
        cartLoaded && checkoutLoaded,
        activeStepIndex,
        !!isShippingRequiredForProducts
      )}
      cartSummary={prepareCartSummary(
        totalPrice,
        subtotalPrice,
        shippingTaxedPrice,
        promoTaxedPrice,
        items
      )}
      checkout={checkoutView}
      button={getButton(buttonText.toUpperCase(), handleNextStepClick)}
    />
  );
};

export { CheckoutPage };
